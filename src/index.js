import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';

/*
  FoodConnect - Student Project Entry Point
  -----------------------------------------
  1. BrowserRouter wraps all pages so <Link> and useNavigate() work (from react-router-dom).
  2. AppProvider (React Context) wraps the app to share users / food posts / session globally.
  3. App.js renders the correct page based on URL route (Home / Login / Register / Dashboard etc.)
*/

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
