import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Layout from './components/Layout'
import RouteMeta from './components/RouteMeta'
import Home from './pages/Home'

// 首页保持同步（落地页，懒加载会多一个往返）；
// 其余页面按路由拆分，首屏不再下载全部代码
const Archive = lazy(() => import('./pages/Archive'))
const Categories = lazy(() => import('./pages/Categories'))
const Tags = lazy(() => import('./pages/Tags'))
const About = lazy(() => import('./pages/About'))
const Moments = lazy(() => import('./pages/Moments'))
const Write = lazy(() => import('./pages/Write'))
const Growth = lazy(() => import('./pages/Growth'))
const PostDetail = lazy(() => import('./pages/PostDetail'))

function NotFound() {
  return (
    <div className="empty big">
      <p>页面走丢了</p>
      <Link to="/" className="empty-link">
        回到主页
      </Link>
    </div>
  )
}

const PageLoading = () => (
  <div className="empty big">
    <p>加载中…</p>
  </div>
)

export default function App() {
  const [query, setQuery] = useState('')

  return (
    <>
      <RouteMeta />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* 写作页不套三栏布局，手机上打开更清爽 */}
          <Route path="/write" element={<Write />} />
          {/* 成长专栏：私密页，独立壳 + 密码解锁 */}
          <Route path="/growth" element={<Growth />} />
          <Route element={<Layout query={query} onQueryChange={setQuery} />}>
            <Route path="/" element={<Home />} />
            <Route path="/category/:name" element={<Home mode="category" />} />
            <Route path="/tag/:name" element={<Home mode="tag" />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/moments" element={<Moments />} />
            <Route path="/about" element={<About />} />
            <Route path="/post/:slug" element={<PostDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
