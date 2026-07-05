import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth-context'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Login } from '@/pages/Login'
import { Library } from '@/pages/Library'
import { Comic } from '@/pages/Comic'
import { PageEditor } from '@/pages/PageEditor'
import { CharacterLibrary } from '@/pages/CharacterLibrary'
import { ShareViewer } from '@/pages/ShareViewer'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/view/:shareToken" element={<ShareViewer />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/comics/:id"
            element={
              <ProtectedRoute>
                <Comic />
              </ProtectedRoute>
            }
          />
          <Route
            path="/comics/:id/pages/:pageId"
            element={
              <ProtectedRoute>
                <PageEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/characters"
            element={
              <ProtectedRoute>
                <CharacterLibrary />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
