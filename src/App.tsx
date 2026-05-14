import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import SquarePage from './pages/SquarePage';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SquarePage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
