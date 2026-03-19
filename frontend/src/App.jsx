import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';
import AdminPage from './pages/AdminPage';
import AuctionPage from './pages/AuctionPage';
import AuctionCompletePage from './pages/AuctionCompletePage';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auction/:roomId" element={<AuctionPage />} />
          <Route path="/auction-complete/:roomId" element={<AuctionCompletePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
