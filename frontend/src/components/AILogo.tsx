/**
 * 通用 AI 助手图标（星芒）。
 *
 * 之前这里用的是 DeepSeek 官方 Logo，但项目支持切换任意 OpenAI 兼容模型
 * （DeepSeek / GLM / Kimi / 豆包…），把某一家厂商的商标当作产品功能图标，
 * 既会误导用户也会带来商标使用问题。这里改用厂商中立的星芒符号。
 */
export function AILogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      role="img"
      aria-label="AI"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11.4 3.4a.63.63 0 0 1 1.2 0l1.6 4.2a3.6 3.6 0 0 0 2.14 2.14l4.2 1.6a.63.63 0 0 1 0 1.2l-4.2 1.6a3.6 3.6 0 0 0-2.14 2.14l-1.6 4.2a.63.63 0 0 1-1.2 0l-1.6-4.2a3.6 3.6 0 0 0-2.14-2.14l-4.2-1.6a.63.63 0 0 1 0-1.2l4.2-1.6A3.6 3.6 0 0 0 9.8 7.6l1.6-4.2Z"
        fill="currentColor"
      />
      <path
        d="M18.7 3.1a.42.42 0 0 1 .79 0l.5 1.3c.13.35.4.62.75.75l1.3.5a.42.42 0 0 1 0 .79l-1.3.5a1.24 1.24 0 0 0-.75.75l-.5 1.3a.42.42 0 0 1-.79 0l-.5-1.3a1.24 1.24 0 0 0-.75-.75l-1.3-.5a.42.42 0 0 1 0-.79l1.3-.5c.35-.13.62-.4.75-.75l.5-1.3Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  )
}

export default AILogo
