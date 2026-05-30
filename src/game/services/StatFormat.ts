// 大數字壓縮顯示(progression_v1 §3 Stat Compression UI)
// < 1000 整數;1K-1M K;1M-1B M;1B-1T B;1T-1Q T;1Q Q;> 1Q 字母後綴 aa, ab...
// 範例對齊設計:12.5K / 50.2M / 1.27B(~3 sig figs)
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Q'];

// 依量級決定小數位,維持 ~3 sig figs(1.27 / 12.5 / 125)
function decimals(v: number): number {
    return v < 10 ? 2 : v < 100 ? 1 : 0;
}

export function formatStat(n: number): string {
    if (!Number.isFinite(n)) return '0';
    const neg = n < 0;
    let v = Math.abs(n);
    if (v < 1000) {
        const whole = Math.floor(v);
        return (neg && whole > 0 ? '-' : '') + whole.toString();
    }
    let tier = 0;
    while (v >= 1000) { v /= 1000; tier++; }
    let s = v.toFixed(decimals(v));
    // rounding 後若進位到 >= 1000(如 999.95→1000)再升一 tier
    if (parseFloat(s) >= 1000) { v /= 1000; tier++; s = v.toFixed(decimals(v)); }
    s = s.replace(/\.?0+$/, '');  // 去尾 0
    let suffix: string;
    if (tier < SUFFIX.length) {
        suffix = SUFFIX[tier];
    } else {
        const idx = tier - SUFFIX.length;  // 0 = aa
        suffix = String.fromCharCode(97 + Math.floor(idx / 26)) + String.fromCharCode(97 + (idx % 26));
    }
    return (neg ? '-' : '') + s + suffix;
}
