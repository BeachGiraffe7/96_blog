import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Layout from './components/Layout'
import RouteMeta from './components/RouteMeta'
import Home from './pages/Home'
import Archive from './pages/Archive'
import Categories from './pages/Categories'
import Tags from './pages/Tags'
import About from './pages/About'
import Moments from './pages/Moments'
import Write from './pages/Write'
import PostDetail from './pages/PostDetail'

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

export default function App() {
  const [query, setQuery] = useState('')

  return (
    <>
      <RouteMeta />
      <Routes>
        {/* 写作页不套三栏布局，手机上打开更清爽 */}
        <Route path="/write" element={<Write />} />
        <Route element={<Layout query={query} onQueryChange={setQuery} />}>
          <Route path="/" element={<Home />} />
          <Route path="/category/:name" element={<Home />} />
          <Route path="/tag/:name" element={<Home />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/moments" element={<Moments />} />
          <Route path="/about" element={<About />} />
          <Route path="/post/:slug" element={<PostDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
