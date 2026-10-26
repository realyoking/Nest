// zh dates in HK written style: 2026年10月18日（週日） — the weekday in full-width brackets.
export const zhDateStyle = (x) => String(x).replace(/日\s*([週周](?:[一二三四五六日天]))/, '日（$1）').replace(/日\s*(星期[一二三四五六日天])/, '日（$1）');
