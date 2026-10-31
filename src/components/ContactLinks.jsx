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
  const [open, setOpen] = useState(null)
  const [message, setMessage] = useState('')
  const panelId = useId()
  const channels = {
    email: {
      label: 'QQ 邮箱',
      name: '邮箱地址',
      value: site.email,
      Icon: Icon.mail,
    },
    wechat: {
      label: '微信',
      name: '微信号',
      value: site.wechat,
      Icon: WechatIcon,
    },
  }
  async function copyContact(kind) {
    const contact = channels[kind]
    try {
      await navigator.clipboard.writeText(contact.value)
      setMessage(`${contact.name}已复制`)
    } catch {
      setMessage(`未能自动复制，请选中${contact.name}手动复制。`)
    }
  }
  function renderContact(kind) {
    const contact = channels[kind]
    const ContactIcon = contact.Icon
    return detailed ? (
      <div className="contact-option">
        <ContactIcon />
        <span>
          <strong>{contact.label}</strong>
          <span className="contact-id">{contact.value}</span>
          <button
            type="button"
            className="contact-copy"
            onClick={() => copyContact(kind)}
          >
            复制{contact.name}
          </button>
        </span>
      </div>
    ) : (
      <button
        type="button"
        className="contact-option"
        aria-label={`查看${contact.label}联系方式`}
        title={contact.label}
        aria-expanded={open === kind}
        aria-controls={panelId}
        onClick={() => {
          setOpen(open === kind ? null : kind)
          setMessage('')
        }}
      >
        <ContactIcon />
      </button>
    )
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
        {renderContact('email')}
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
        {renderContact('wechat')}
      </div>
      {!detailed && open && (
        <div className="contact-detail-panel" id={panelId}>
          <span>{channels[open].name}</span>
          <span className="contact-id">{channels[open].value}</span>
          <button
            type="button"
            className="contact-copy"
            onClick={() => copyContact(open)}
          >
            复制{channels[open].name}
          </button>
        </div>
      )}
      <p className="contact-feedback" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
