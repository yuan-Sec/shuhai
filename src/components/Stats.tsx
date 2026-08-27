import { useState, useEffect } from 'react'
import { getAllBooks, getSettings, getStats, getTotalStats, type ReadingStat } from '../lib/db'

export function Stats() {
  const [totalBooks, setTotalBooks] = useState(0)
  const [readingBooks, setReadingBooks] = useState(0)
  const [finishedBooks, setFinishedBooks] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [stats, setStats] = useState<ReadingStat[]>([])
  const [formatDist, setFormatDist] = useState<Record<string, number>>({})
  const [goalMinutes, setGoalMinutes] = useState(30)

  useEffect(() => {
    (async () => {
      const books = await getAllBooks()
      setTotalBooks(books.length)
      setReadingBooks(books.filter(b => b.progress > 0 && b.progress < 0.99).length)
      setFinishedBooks(books.filter(b => b.progress >= 0.99).length)

      const total = await getTotalStats()
      setTotalMinutes(total.totalMinutes)

      const s = await getStats(14)
      setStats(s)

      // 格式分布
      const dist: Record<string, number> = {}
      for (const b of books) {
        dist[b.format] = (dist[b.format] || 0) + 1
      }
      setFormatDist(dist)
      setGoalMinutes((await getSettings()).readingGoalMinutes)
    })()
  }, [])

  const maxMinutes = Math.max(...stats.map(s => s.totalMinutes), goalMinutes)
  const totalWeekMinutes = stats.slice(-7).reduce((sum, s) => sum + s.totalMinutes, 0)
  const avgPerDay = Math.round(totalWeekMinutes / 7)
  const todayMinutes = stats.at(-1)?.totalMinutes || 0
  const goalProgress = Math.min(100, Math.round((todayMinutes / Math.max(1, goalMinutes)) * 100))
  const streak = [...stats].reverse().reduce((days, stat, index) => {
    if (index === days && stat.totalMinutes > 0) return days + 1
    return days
  }, 0)

  return (
    <div className="stats-page">
      <header className="page-header">
        <h1>阅读统计</h1>
      </header>

      <div className="stats-scroll">
        <section className="reading-insight">
          <div className="goal-ring" style={{ '--goal': `${goalProgress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{goalProgress}%</strong><span>今日目标</span></div>
          </div>
          <div className="insight-copy">
            <span className="section-label">今日阅读</span>
            <h2>{todayMinutes >= goalMinutes ? '今天的目标已完成' : `再读 ${Math.max(0, goalMinutes - todayMinutes)} 分钟`}</h2>
            <p>已阅读 {formatMinutes(todayMinutes)} · 连续 {streak} 天</p>
          </div>
        </section>

        {/* 概览卡片 */}
        <div className="stats-cards-row">
          <div className="stats-card">
            <div className="stats-card-value">{totalBooks}</div>
            <div className="stats-card-label">总书籍</div>
          </div>
          <div className="stats-card accent">
            <div className="stats-card-value">{readingBooks}</div>
            <div className="stats-card-label">阅读中</div>
          </div>
          <div className="stats-card success">
            <div className="stats-card-value">{finishedBooks}</div>
            <div className="stats-card-label">已完成</div>
          </div>
        </div>

        {/* 时间统计 */}
        <div className="stats-section">
          <div className="stats-section-header">
            <h2>阅读时长</h2>
            <span className="stats-section-sub">
              本周 {formatMinutes(totalWeekMinutes)} · 日均 {formatMinutes(avgPerDay)}
            </span>
          </div>
          <div className="stats-chart">
            {stats.map((s, i) => {
              const h = (s.totalMinutes / maxMinutes) * 100
              const isToday = i === stats.length - 1
              return (
                <div key={s.date} className="chart-bar-wrap">
                  <div className="chart-bar-col">
                    <div
                      className={`chart-bar ${isToday ? 'today' : ''} ${s.totalMinutes === 0 ? 'empty' : ''}`}
                      style={{ height: `${Math.max(h, 2)}%` }}
                    />
                  </div>
                  <span className="chart-bar-label">
                    {new Date(s.date).toLocaleDateString('zh', { weekday: 'narrow' })}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="stats-total">
            累计阅读 <strong>{formatMinutes(totalMinutes)}</strong>
          </div>
        </div>

        {/* 格式分布 */}
        {Object.keys(formatDist).length > 0 && (
          <div className="stats-section">
            <h2>格式分布</h2>
            <div className="format-bars">
              {Object.entries(formatDist).sort((a, b) => b[1] - a[1]).map(([fmt, count]) => {
                const pct = (count / totalBooks) * 100
                const colors: Record<string, string> = {
                  epub: '#4CAF50', pdf: '#2196F3', txt: '#9E9E9E', mobi: '#FF9800',
                  azw3: '#FF5722', fb2: '#9C27B0', cbz: '#F44336', docx: '#1976D2',
                  md: '#388E3C', html: '#FFC107', rtf: '#607D8B',
                }
                return (
                  <div key={fmt} className="format-bar-item">
                    <span className="format-bar-label">{fmt.toUpperCase()}</span>
                    <div className="format-bar-track">
                      <div className="format-bar-fill" style={{ width: `${pct}%`, background: colors[fmt] || '#666' }} />
                    </div>
                    <span className="format-bar-count">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 阅读成就 */}
        <div className="stats-section">
          <h2>阅读成就</h2>
          <div className="badges">
            <Achievement icon="📚" title="藏书家" desc={`收藏 ${totalBooks} 本书`} unlocked={totalBooks >= 1} />
            <Achievement icon="🔥" title="初读" desc="打开第一本书" unlocked={totalBooks >= 1} />
            <Achievement icon="📖" title="深入阅读" desc="阅读进度过半" unlocked={readingBooks > 0 || finishedBooks > 0} />
            <Achievement icon="✅" title="完读达人" desc="读完一本书" unlocked={finishedBooks >= 1} />
            <Achievement icon="📅" title="坚持一周" desc="连续7天阅读" unlocked={streak >= 7} />
            <Achievement icon="🌟" title="书海漫游" desc="收藏10本书" unlocked={totalBooks >= 10} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Achievement({ icon, title, desc, unlocked }: { icon: string; title: string; desc: string; unlocked: boolean }) {
  return (
    <div className={`badge-card ${unlocked ? 'unlocked' : 'locked'}`}>
      <span className="badge-icon">{unlocked ? icon : '🔒'}</span>
      <div className="badge-info">
        <div className="badge-title">{title}</div>
        <div className="badge-desc">{desc}</div>
      </div>
    </div>
  )
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}小时${m}分` : `${h}小时`
}
