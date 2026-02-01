import { Outlet, NavLink } from 'react-router-dom'

function Layout() {
  return (
    <>
      <nav className="nav">
        <div className="container nav-content">
          <NavLink to="/" className="nav-brand">
            📚 Collections Ultimate
          </NavLink>
          <ul className="nav-links">
            <li>
              <NavLink 
                to="/" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                end
              >
                Home
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/library" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                My Library
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/add-book" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Add Book
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </>
  )
}

export default Layout
