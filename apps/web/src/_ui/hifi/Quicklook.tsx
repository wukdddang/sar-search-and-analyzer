interface Props {
    sceneId: string;
    size?: number;
}

export function Quicklook({ sceneId, size = 56 }: Props) {
    const seed = [...sceneId].reduce((a, c) => a + c.charCodeAt(0), 0);
    const hue = (seed % 40) + 200;
    return (
        <div
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: 4,
                overflow: 'hidden',
                background: `
                    radial-gradient(circle at 30% 40%, hsl(${hue} 40% 28%) 0%, transparent 50%),
                    radial-gradient(circle at 70% 60%, hsl(${hue + 20} 45% 35%) 0%, transparent 50%),
                    repeating-linear-gradient(${seed % 180}deg, hsl(${hue} 20% 12%) 0px, hsl(${hue} 25% 18%) 2px, hsl(${hue} 30% 14%) 4px)
                `,
                border: '1px solid var(--border-default)',
            }}
        />
    );
}
