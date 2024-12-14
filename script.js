// Initialize the map
const map = L.map('map', {
  center: [48.1581, 11.5820],
  zoom: 11,
  minZoom: 7,
  maxZoom: 18
});

// Add a tile layer for the base map (background map)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Variables to store layers and other data
let highlightedLayer = null;
let allLayers = [];
let geojsonNames = [];
let trainLayer = null;
let busStopsLayer = null;
let districtLayer = null; // New variable to hold the district layer

// Fetch and process GeoJSON data for districts, train network, and bus stops
const loadGeoJSON = async (filePath, callback) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load ${filePath}`);
    const data = await response.json();
    callback(data);
  } catch (error) {
    console.error(`Error loading GeoJSON from ${filePath}:`, error);
  }
};

// Load district data
const loadDistrictData = (geojsonData) => {
  const cafeValues = [];
  const educationValues = [];

  districtLayer = L.geoJSON(geojsonData, {
    style: feature => ({
      fillColor: getColor(feature.properties.Intersect_),
      weight: 2,
      color: 'white',
      fillOpacity: 0.7
    }),
    onEachFeature: (feature, layer) => {
      cafeValues.push(feature.properties.cafe || 0);
      educationValues.push(feature.properties.education || 0);
      geojsonNames.push(feature.properties.name || `Unnamed ${geojsonNames.length + 1}`);

      layer.on('click', () => {
        highlightShape(layer);
        displayInfographics(feature);
      });

      allLayers.push(layer);
    }
  });

  // Set zIndex for district layer to always be below other layers
  districtLayer.setZIndex(0); // Ensure district layer is always below

  // Add districts layer as a basemap
  districtLayer.addTo(map);
  updateCombinedChart(cafeValues, educationValues);
};

// Load train network data
const loadTrainNetworkLayer = (geojsonData) => {
  trainLayer = L.geoJSON(geojsonData, {
    style: () => ({
      color: '#fc2680',
      weight: 2,
      opacity: 0.75,
      lineJoin: 'round'
    })
  });

  // Set zIndex for train network layer to be above district layer
  trainLayer.setZIndex(1); // Ensure train network is above district layer

  createLayerControl();
};

// Load bus stops data
const loadBusStopsLayer = (geojsonData) => {
  busStopsLayer = L.geoJSON(geojsonData, {
    style: { weight: 1, opacity: 0.8 },
    pointToLayer: (feature, latlng) => L.marker(latlng, {
      icon: L.icon({
        iconUrl: 'Symbols/bus_stop.png',
        iconSize: [25, 25],
        iconAnchor: [12, 25],
        popupAnchor: [0, -25]
      })
    })
  });

  // Set zIndex for bus stops layer to be above district layer
  busStopsLayer.setZIndex(2); // Ensure bus stops are above district layer

  createLayerControl();
  setBusStopsLayerVisibility(map.getZoom());
  map.on('zoomend', () => setBusStopsLayerVisibility(map.getZoom()));
};

// Set visibility of bus stops layer based on zoom level
const setBusStopsLayerVisibility = (zoomLevel) => {
  const isVisible = zoomLevel >= 17 && zoomLevel <= 18;
  enableBusStopsToggle(isVisible);
};

// Enable or disable bus stops toggle
const enableBusStopsToggle = (enable) => {
  const layerControl = map._controlLayers;
  if (layerControl) {
    const busStopsLayerControl = layerControl._layers[Object.keys(layerControl._layers)
      .find(key => layerControl._layers[key].layer === busStopsLayer)];

    if (busStopsLayerControl) {
      if (enable) {
        busStopsLayerControl.enabled = true;
        busStopsLayerControl._layer.addTo(map);
      } else {
        busStopsLayerControl.enabled = false;
        map.removeLayer(busStopsLayer);
      }
    }
  }
};

// Highlight a district shape
const highlightShape = (layer) => {
  if (highlightedLayer) {
    highlightedLayer.setStyle({ weight: 2, color: 'white', fillOpacity: 0.7 });
  }

  layer.setStyle({ weight: 4, color: '#48ffed', fillOpacity: 0.9 });
  highlightedLayer = layer;
};

// Display infographics in the sidebar
const displayInfographics = (feature) => {
  document.getElementById('cafe-info').innerText = feature.properties.cafe || 'No data';
  document.getElementById('education-info').innerText = feature.properties.education || 'No data';
  document.getElementById('sidebar').style.display = 'block';
};

// Close the sidebar
const closeSidebar = () => {
  document.getElementById('sidebar').style.display = 'none';
};

// Update the combined chart
const updateCombinedChart = (cafeValues, educationValues) => {
  const ctx = document.getElementById('combined-chart').getContext('2d');
  if (window.combinedChart) window.combinedChart.destroy();

  window.combinedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: geojsonNames.map(name => name.length > 15 ? name.substring(0, 15) + '...' : name),
      datasets: [
        {
          label: 'Eateries',
          data: cafeValues,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Education Facilities',
          data: educationValues,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#f8f9fa' } }
      },
      scales: {
        x: {
          ticks: {
            color: '#f8f9fa',
            maxRotation: 45,
            minRotation: 30,
            autoSkip: true,
            callback: (value) => value
          }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#f8f9fa' }
        }
      }
    }
  });

  document.querySelector('.combined-visualization').addEventListener('click', () => showEnlargedChart(cafeValues, educationValues));
};

// Show enlarged chart in modal
const showEnlargedChart = (cafeValues, educationValues) => {
  const chartModal = document.getElementById('chart-modal');
  chartModal.style.display = 'flex';

  const enlargedCtx = document.getElementById('enlarged-chart').getContext('2d');
  if (window.enlargedChart) window.enlargedChart.destroy();

  window.enlargedChart = new Chart(enlargedCtx, {
    type: 'bar',
    data: {
      labels: geojsonNames.map(name => name.length > 15 ? name.substring(0, 15) + '...' : name),
      datasets: [
        {
          label: 'Eateries',
          data: cafeValues,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Education Facilities',
          data: educationValues,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: { responsive: true, plugins: { legend: { display: true, position: 'top' } } }
  });
};

// Close the chart modal
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('chart-modal').style.display = 'none';
});

// Helper function for color scale
const getColor = (value) => {
  return value > 50 ? '#006d2c' :
         value > 16 ? '#31a354' :
         value > 7.1 ? '#74c476' :
         value > 4.3 ? '#bae4b3' :
         value > 2.5 ? '#edf8e9' :
         value > 0   ? '#FED976' : '#FFEDA0';
};

// Create interactive legend
const createLegend = () => {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
      <h4>Legend</h4>
      <h5>Percentage of District<br> covered by Parks (%)</h5>
      <div id="legend-content"></div>
      <div class="legend-symbols">
        <h5>Symbols:</h5>
        <div><span class="train-line" style="background-color: #fc2680;"></span> Train Network</div>
        <div><img src="Symbols/bus_stop.png" alt="Bus Stop" style="width: 20px; height: 20px;"> Bus Stops</div>
      </div>
      <button id="reset-button">Reset</button>
    `;
    return div;
  };

  legend.addTo(map);
  generateLegendContent();
  document.getElementById('reset-button').addEventListener('click', resetLayers);
};

// Add a style for the train line
const styleTrainLineInLegend = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .legend-symbols .train-line {
      width: 40px;
      height: 5px;
      display: inline-block;
      background-color: #fc2680;
      margin-right: 10px;
    }
  `;
  document.head.appendChild(style);
};

// Call the style function
styleTrainLineInLegend();

// Generate legend items
const generateLegendContent = () => {
  const legendContent = document.getElementById('legend-content');
  const grades = [0, 2.5, 4.3, 7.1, 16, 50];
  
  grades.forEach((grade, i) => {
    const nextGrade = grades[i + 1] || '+';
    const color = getColor(grade);
    const item = document.createElement('div');
    
    item.className = 'legend-item';
    item.innerHTML = `<span style="background:${color}; width: 20px; height: 20px; display: inline-block; border: 1px solid #000;"></span> ${grade}–${nextGrade}`;
    item.addEventListener('click', () => filterShapesByColor(color));
    legendContent.appendChild(item);
  });
};

// Filter shapes by color
const filterShapesByColor = (color) => {
  allLayers.forEach(layer => {
    const featureColor = getColor(layer.feature.properties.Intersect_);
    if (featureColor === color) {
      map.addLayer(layer);
    } else {
      map.removeLayer(layer);
    }
  });
};

// Reset all layers to their original state, ensuring district layer stays at the bottom
const resetLayers = () => {
  allLayers.forEach(layer => {
    if (!map.hasLayer(layer)) {
      map.addLayer(layer);
    }
  });

  // Ensure the district layer is always below
  if (districtLayer) districtLayer.setZIndex(0);

  // Reapply zIndex for train and bus layers
  if (trainLayer) trainLayer.setZIndex(1);
  if (busStopsLayer) busStopsLayer.setZIndex(2);

  // Reapply the correct layer stack after reset
  map.getPanes().overlayPane.appendChild(map.getPanes().overlayPane.firstChild);
};

// Create the layer control
const createLayerControl = () => {
  const overlayMaps = { "Train Network": trainLayer, "Bus Stops": busStopsLayer };
  L.control.layers(null, overlayMaps).addTo(map);
};

// Load all GeoJSON data
const loadData = () => {
  loadGeoJSON('Park/Munich_Districts.geojson', loadDistrictData);
  loadGeoJSON('Park/Train_network.geojson', loadTrainNetworkLayer);
  loadGeoJSON('Park/Munich_Bus_Stops.geojson', loadBusStopsLayer);
};

// Initialize
loadData();
createLegend();
