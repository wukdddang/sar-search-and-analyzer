'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from './Icon';

interface Props {
    start: Date;
    end: Date;
    onChange: (start: Date, end: Date) => void;
    /** 선택 가능한 최대 날짜 (기본: 제한 없음). */
    maxDate?: Date;
    /** 선택 가능한 최소 날짜 (기본: 제한 없음). */
    minDate?: Date;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * 날짜 범위를 선택하는 커스텀 캘린더 피커.
 * 시작 · 종료 두 입력 중 하나를 클릭하면 팝오버로 월 달력이 열리고, 범위를 선택하면 자동으로 닫힌다.
 * 외부 클릭/Escape 로도 닫힌다.
 */
export function DateRangePicker({ start, end, onChange, maxDate, minDate }: Props) {
    const [open, setOpen] = useState(false);
    const [focus, setFocus] = useState<'start' | 'end'>('start');
    const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(start));
    const [hovered, setHovered] = useState<Date | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // 외부 클릭/Escape로 닫기
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // 열 때마다 현재 포커스 입력에 맞춰 보이는 달 동기화
    useEffect(() => {
        if (!open) return;
        const anchor = focus === 'start' ? start : end;
        setViewMonth(startOfMonth(anchor));
    }, [open, focus, start, end]);

    const cells = useMemo(() => {
        const first = startOfMonth(viewMonth);
        const startWeekday = first.getDay();
        const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
        const arr: Array<Date | null> = [];
        for (let i = 0; i < startWeekday; i++) arr.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            arr.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
        }
        while (arr.length % 7 !== 0) arr.push(null);
        return arr;
    }, [viewMonth]);

    const openFor = (which: 'start' | 'end') => {
        setFocus(which);
        setOpen(true);
    };

    const selectDate = (date: Date) => {
        const d = startOfDay(date);
        if (focus === 'start') {
            if (d > startOfDay(end)) {
                onChange(d, d);
            } else {
                onChange(d, end);
            }
            setFocus('end');
        } else {
            if (d < startOfDay(start)) {
                onChange(d, start);
            } else {
                onChange(start, d);
            }
            setOpen(false);
            setFocus('start');
        }
    };

    const isDisabled = (d: Date): boolean => {
        if (maxDate && startOfDay(d) > startOfDay(maxDate)) return true;
        if (minDate && startOfDay(d) < startOfDay(minDate)) return true;
        return false;
    };

    const today = startOfDay(new Date());
    const sDay = startOfDay(start);
    const eDay = startOfDay(end);

    // 호버 기반 미리보기 범위 (아직 선택 안 끝났을 때)
    const previewEnd = hovered && focus === 'end' && startOfDay(hovered) >= sDay ? startOfDay(hovered) : null;

    const goMonth = (delta: number) =>
        setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

    return (
        <div ref={wrapperRef} className="daterange" style={{ position: 'relative' }}>
            <div className="input-group">
                <button
                    type="button"
                    className={`input mono tabular daterange__trigger${focus === 'start' && open ? ' daterange__trigger--active' : ''}`}
                    onClick={() => openFor('start')}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                >
                    <Icon name="calendar" size={12} style={{ marginRight: 6, opacity: 0.6 }} />
                    {fmt(start)}
                </button>
                <button
                    type="button"
                    className={`input mono tabular daterange__trigger${focus === 'end' && open ? ' daterange__trigger--active' : ''}`}
                    onClick={() => openFor('end')}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                >
                    {fmt(end)}
                </button>
            </div>

            {open ? (
                <div className="daterange__pop" role="dialog" aria-label="날짜 범위 선택">
                    <div className="daterange__head">
                        <button
                            type="button"
                            className="daterange__nav"
                            aria-label="이전 달"
                            onClick={() => goMonth(-1)}
                        >
                            <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <div className="daterange__title">
                            {viewMonth.getFullYear()}년 {MONTH_KO[viewMonth.getMonth()]}
                        </div>
                        <button
                            type="button"
                            className="daterange__nav"
                            aria-label="다음 달"
                            onClick={() => goMonth(1)}
                        >
                            <Icon name="chevronRight" size={14} />
                        </button>
                    </div>
                    <div className="daterange__weekdays">
                        {WEEKDAY_KO.map((w, i) => (
                            <div
                                key={w}
                                className="daterange__weekday"
                                data-weekend={i === 0 || i === 6 ? 'true' : undefined}
                            >
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="daterange__grid" onMouseLeave={() => setHovered(null)}>
                        {cells.map((d, i) => {
                            if (!d) return <div key={i} className="daterange__cell daterange__cell--empty" />;
                            const day = startOfDay(d);
                            const disabled = isDisabled(day);
                            const isStart = sameDay(day, sDay);
                            const isEnd = sameDay(day, eDay);
                            const inRange = day >= sDay && day <= eDay;
                            const inPreview = previewEnd
                                ? day > eDay && day <= previewEnd
                                : false;
                            const isToday = sameDay(day, today);
                            const weekday = day.getDay();
                            const classes = ['daterange__cell'];
                            if (disabled) classes.push('daterange__cell--disabled');
                            if (inRange) classes.push('daterange__cell--in-range');
                            if (inPreview) classes.push('daterange__cell--in-preview');
                            if (isStart) classes.push('daterange__cell--start');
                            if (isEnd) classes.push('daterange__cell--end');
                            if (isToday) classes.push('daterange__cell--today');
                            if (weekday === 0) classes.push('daterange__cell--sun');
                            if (weekday === 6) classes.push('daterange__cell--sat');
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    className={classes.join(' ')}
                                    disabled={disabled}
                                    onClick={() => selectDate(day)}
                                    onMouseEnter={() => setHovered(day)}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                    <div className="daterange__foot">
                        <span className="faint" style={{ fontSize: 11 }}>
                            {focus === 'start' ? '시작일을 선택하세요' : '종료일을 선택하세요'}
                        </span>
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setOpen(false)}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
