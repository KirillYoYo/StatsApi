import { Navigate, Route, Routes } from 'react-router-dom';
import './App.scss';
import { Stats } from './features/stats/stats';
import Measures from './features/measures.tsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/stats" />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/measures" element={<Measures />} />
    </Routes>
  );
}

export default App;
