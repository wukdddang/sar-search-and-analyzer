const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function 바이트를_사람_단위로_변환한다(bytes: number, fractionDigits = 1): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < UNITS.length - 1) {
        value /= 1024;
        index += 1;
    }
    return `${value.toFixed(fractionDigits)} ${UNITS[index]}`;
}
