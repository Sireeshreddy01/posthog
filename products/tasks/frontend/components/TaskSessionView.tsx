import { useEffect, useMemo, useRef, useState } from 'react'
import { TextMorph } from 'torph/react'

import { IconChevronDown, IconCopy } from '@posthog/icons'
import { LemonButton, Spinner } from '@posthog/lemon-ui'

import { lemonToast } from 'lib/lemon-ui/LemonToast/LemonToast'

import { LogEntry, parseLogs } from '../lib/parse-logs'
import { TaskRun } from '../types'
import { TaskRunStatusBadge } from './TaskRunStatusBadge'
import { ConsoleLogEntry } from './session/ConsoleLogEntry'
import { ToolCallEntry } from './session/ToolCallEntry'

const HEDGEHOG_STATUSES = [
    'Spiking...',
    'Hedgehogging...',
    'Snuffling...',
    'Curling up...',
    'Foraging...',
    'Quilling...',
    'Hibernating...',
    'Scurrying...',
    'Bristling...',
    'Noodling...',
    'Hogwatching...',
    'Prickling...',
    'Burrowing...',
    'Snoot booping...',
    'Uncurling...',
]

function HedgehogStatus(): JSX.Element {
    const [statusIndex, setStatusIndex] = useState(() => Math.floor(Math.random() * HEDGEHOG_STATUSES.length))

    useEffect(() => {
        const interval = setInterval(() => {
            setStatusIndex((prev) => (prev + 1) % HEDGEHOG_STATUSES.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="flex items-center gap-2 py-2 text-muted">
            <Spinner className="text-xs" />
            <TextMorph as="span" className="text-xs">
                {HEDGEHOG_STATUSES[statusIndex]}
            </TextMorph>
        </div>
    )
}

interface TaskSessionViewProps {
    logs: string
    isPolling: boolean
    run: TaskRun | null
}

const USER_MSG_COLLAPSED_HEIGHT = 120

function UserLogEntry({ message, timestamp }: { message: string; timestamp?: string }): JSX.Element {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isOverflowing, setIsOverflowing] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = contentRef.current
        if (el) {
            setIsOverflowing(el.scrollHeight > USER_MSG_COLLAPSED_HEIGHT)
        }
    }, [message])

    return (
        <div className="py-2 flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">User</span>
                {timestamp && <span className="text-xs text-muted">{new Date(timestamp).toLocaleTimeString()}</span>}
            </div>
            <div className="border-r-2 border-muted pr-3 max-w-[90%] text-right">
                <div
                    ref={contentRef}
                    className="relative overflow-hidden text-sm whitespace-pre-wrap"
                    style={!isExpanded && isOverflowing ? { maxHeight: USER_MSG_COLLAPSED_HEIGHT } : undefined}
                >
                    {message}
                    {!isExpanded && isOverflowing && (
                        <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
                            // eslint-disable-next-line react/forbid-dom-props
                            style={{ background: 'linear-gradient(transparent, var(--bg-3000))' }}
                        />
                    )}
                </div>
                {isOverflowing && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-default cursor-pointer"
                    >
                        <IconChevronDown
                            className="transition-transform"
                            // eslint-disable-next-line react/forbid-dom-props
                            style={isExpanded ? { transform: 'rotate(180deg)' } : undefined}
                        />
                        {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                )}
            </div>
        </div>
    )
}

function LogEntryRenderer({ entry }: { entry: LogEntry }): JSX.Element | null {
    switch (entry.type) {
        case 'console':
            return (
                <ConsoleLogEntry
                    level={entry.level || 'info'}
                    message={entry.message || ''}
                    timestamp={entry.timestamp}
                />
            )
        case 'tool':
            return (
                <ToolCallEntry
                    toolName={entry.toolName || 'unknown'}
                    status={entry.toolStatus || 'pending'}
                    args={entry.toolArgs}
                    result={entry.toolResult}
                    timestamp={entry.timestamp}
                />
            )
        case 'user':
            return <UserLogEntry message={entry.message || ''} timestamp={entry.timestamp} />
        case 'agent':
            return (
                <div className="py-2">
                    <div className="flex items-center gap-2 mb-1">
                        {entry.timestamp && (
                            <span className="text-xs text-muted">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        )}
                        <span className="text-xs font-medium">Agent</span>
                    </div>
                    <div className="border-l-2 border-primary pl-3 max-w-[90%]">
                        <div className="text-sm whitespace-pre-wrap">{entry.message}</div>
                    </div>
                </div>
            )
        case 'system':
            return (
                <div className="flex items-center gap-2 py-1">
                    {entry.timestamp && (
                        <span className="text-xs text-muted">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    )}
                    <span className="text-xs text-muted italic">{entry.message}</span>
                </div>
            )
        case 'raw':
            return <div className="py-0.5 text-xs font-mono text-muted break-all">{entry.raw}</div>
        default:
            return null
    }
}

export function TaskSessionView({ logs, isPolling, run }: TaskSessionViewProps): JSX.Element {
    const entries = useMemo(() => parseLogs(logs), [logs])

    const handleCopyLogs = (): void => {
        navigator.clipboard.writeText(logs).then(
            () => lemonToast.success('Logs copied to clipboard'),
            () => lemonToast.error('Failed to copy logs')
        )
    }

    if (entries.length === 0) {
        return (
            <div className="p-4 text-center text-muted">
                <p>No logs available yet</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center px-4 py-2 border-b">
                <div className="flex items-center gap-2">
                    {run && <TaskRunStatusBadge run={run} />}
                    <span className="text-sm font-semibold">Logs ({entries.length})</span>
                </div>
                <LemonButton size="xsmall" icon={<IconCopy />} onClick={handleCopyLogs}>
                    Copy
                </LemonButton>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-bg-3000">
                {entries.map((entry) => (
                    <LogEntryRenderer key={entry.id} entry={entry} />
                ))}
                {isPolling && <HedgehogStatus />}
            </div>
        </div>
    )
}
