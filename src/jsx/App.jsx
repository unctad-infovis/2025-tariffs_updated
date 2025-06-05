import React, { /* useState, */useEffect } from 'react';
import '../styles/styles.less';

// Load helpers.
import chartMap from './modules/ChartMap.js';

// const appID = '#app-root-2025-tariffs_updated';

function App() {
  useEffect(() => {
    // Create map
    chartMap();
  }, []);

  return (
    <div className="app">
      <div className="right-content">
        {
          // Controls
        }
        <div className="title_container">
          <img src="https://static.dwcdn.net/custom/themes/unctad-2024-rebrand/Blue%20arrow.svg" className="logo" alt="UN Trade and Development logo" />
          <div className="title">
            <h3>Planned US tariffs are disruptively high for many vulnerable economies</h3>
            <h4>Trade-weighted applied tariffs on US imports if country-specific tariffs are applied</h4>
          </div>
        </div>
        <div id="controls" className="slider-wrapper">
          <div className="slider-stack">
            <div className="slider-labels">
              <span>
                <strong>Pre</strong>
                {' '}
                <br />
                January 2025
              </span>
              <span>
                <strong>During</strong>
                {' '}
                <br />
                90-day pause
              </span>
              <span>
                <strong>After</strong>
                {' '}
                <br />
                90-day pause
              </span>
            </div>
            <input type="range" id="tariff_structureSlider" min="1" max="3" step="1" />
          </div>
        </div>
        {
          // Map Container
        }
        <div id="map_container" />
      </div>
    </div>
  );
}

export default App;
