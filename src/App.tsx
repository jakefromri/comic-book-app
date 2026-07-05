import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Login } from '@/pages/Login'
import { Library } from '@/pages/Library'
import { Comic } from '@/pages/Comic'
import { PageEditor } from '@/pages/PageEditor'
import { ShareViewer } from '@/pages/ShareViewer'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Library />} />
        <Route path="/comics/:id" element={<Comic />} />
        <Route path="/comics/:id/pages/:pageId" element={<PageEditor />} />
        <Route path="/view/:shareToken" element={<ShareViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
