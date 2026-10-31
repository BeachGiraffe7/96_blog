import { useId, useState } from 'react'
import { site } from '../data/posts'
import { Icon } from './Icons'
import '../styles/contact.css'

function WechatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 11.2c0 4.5-3.8 7.7-8.5 7.7-1.2 0-2.4-.2-3.4-.6L4 20l1.2-4C4.1 14.7 3.5 13 3.5 11.2c0-4.2 3.8-7.6 8.5-7.6s8.5 3.4 8.5 7.6Z" />
      <circle cx="8.5" cy="11" r=".8" fill="currentColor" />
      <circle cx="15.5" cy="11" r=".8" fill="currentColor" />
    </svg>
  )
}

export default function ContactLinks({ detailed = false }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const panelId = useId()
  async function copyWechat() {
    try {
      await navigator.clipboard.writeText(site.wechat)
      setMessage('微信号已复制')
    } catch {
      setMessage('未能自动复制，请选中微信号手动复制。')
    }
  }
  return (
    <div
      className={
        detailed
          ? 'contact-links contact-links--detailed'
          : 'contact-links contact-links--compact'
      }
    >
      <div className="contact-options">
        <a
          className="contact-option"
          href={site.github}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub 个人主页"
          title="GitHub 个人主页"
        >
          <Icon.github />
          {detailed && (
            <span>
              <strong>GitHub</strong>
              <span>个人主页 ↗</span>
            </span>
          )}
        </a>
        <a
          className="contact-option"
          href={`mailto:${site.email}`}
          aria-label={`QQ 邮箱：${site.email}`}
          title={`QQ 邮箱：${site.email}`}
        >
          <Icon.mail />
          {detailed && (
            <span>
              <strong>QQ 邮箱</strong>
              <span>{site.email}</span>
            </span>
          )}
        </a>
        {detailed ? (
          <div className="contact-option contact-wechat">
            <WechatIcon />
            <span>
              <strong>微信</strong>
              <span className="contact-id">{site.wechat}</span>
              <button
                type="button"
                className="contact-copy"
                onClick={copyWechat}
              >
                复制微信号
              </button>
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="contact-option"
            aria-label="查看微信联系方式"
            title="微信"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              setOpen(!open)
              setMessage('')
            }}
          >
            <WechatIcon />
          </button>
        )}
      </div>
      {!detailed && open && (
        <div className="contact-wechat-panel" id={panelId}>
          <span>微信号</span>
          <span className="contact-id">{site.wechat}</span>
          <button type="button" className="contact-copy" onClick={copyWechat}>
            复制微信号
          </button>
        </div>
      )}
      <p className="contact-feedback" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
