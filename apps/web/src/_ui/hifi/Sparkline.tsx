interface Props {
    points: number[];
    color?: string;
    w?: number;
    h?: number;
}

export function Sparkline({ points, color = 'var(--accent)', w = 80, h = 24 }: Props) {
    if (points.length === 0) return null;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const step = w / Math.max(1, points.length - 1);
    const d = points
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step},${h - ((v - min) / range) * h}`)
        .join(' ');
    return (
        <svg width={w} height={h} style={{ display: 'block' }}>
            <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
