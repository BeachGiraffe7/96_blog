import { createContext } from 'react'

// 单独放一个文件：Layout 渲染 Outlet，PostDetail 又要导入它，避免循环依赖
export const TocContext = createContext(() => {})
