// -------------------------------
// 1️⃣ Base Layer
// -------------------------------
const osmLayer = new ol.layer.Tile({
  source: new ol.source.OSM(),
});

// -------------------------------
// 2️⃣ WMS Layer (DEFINE IT FIRST)
// -------------------------------
const wmsLayer = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    url: "http://localhost:8080/geoserver/wms",
    params: {
      LAYERS: "carbonGEO:post_district_emission",
    },
    serverType: "geoserver",
    crossOrigin: "anonymous",
  }),
});

// -------------------------------
// 3️⃣ Map Initialization
// -------------------------------
const map = new ol.Map({
  target: "map",
  layers: [osmLayer, wmsLayer],
  view: new ol.View({
    center: ol.proj.fromLonLat([78.9629, 20.5937]),
    zoom: 4,
  }),
});

// District Level highlight Layer
const highlightSource = new ol.source.Vector();

const highlightLayer = new ol.layer.Vector({
  source: highlightSource,
  style: new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: "black",
      width: 0.5,
    }),
    fill: new ol.style.Fill({
      color: "rgba(255,0,0,0.1)",
    }),
  }),
});
map.addLayer(highlightLayer);

const emissionFieldByStyle = {
  co2_emission: "co2_norm",
  co_emission: "co_norm",
  ch4_emission: "ch4_norm",
  thermal_emission: "thermal_norm",
  vehicle_emission: "vehicle_norm",
  forest_emission: "forest_norm",
};

let selectedStyleLayer = "co2_emission";

window.changeEmission = function (styleLayer) {
  const source = wmsLayer.getSource();
  selectedStyleLayer = styleLayer;

  source.updateParams({
    STYLES: styleLayer,
    _refresh: Date.now(),
  });
};

window.changeLevel = function (level) {
  const source = wmsLayer.getSource();
  const selectedField = emissionFieldByStyle[selectedStyleLayer] || "co2_norm";
  let cqlFilter = "";

  if (level === "low") {
    cqlFilter = `${selectedField} >= 0 AND ${selectedField} < 0.33`;
  } else if (level === "medium") {
    cqlFilter = `${selectedField} >= 0.33 AND ${selectedField} < 0.66`;
  } else if (level === "high") {
    cqlFilter = `${selectedField} >= 0.66 AND ${selectedField} <= 1.0`;
  }

  source.updateParams({
    CQL_FILTER: cqlFilter,
    _refresh: Date.now(),
  });
};


window.resetLevel = function () {
  const source = wmsLayer.getSource();

  source.updateParams({
    CQL_FILTER: "INCLUDE",
    _refresh: Date.now(),
  });
};

// ===============================
// FEATURE INFO (Click Popup)
// ===============================
function classifyEmission(value) {
  if (value >= 0.00 && value < 0.33) {
    return "Low";
  } else if (value >= 0.33 && value < 0.66) {
    return "Medium";
  } else if (value >= 0.66 && value <= 1.0) {
    return "High";
  } else {
    return value;
  }
}
map.on("singleclick", function (evt) {
  const viewResolution = map.getView().getResolution();

  const url = wmsLayer
    .getSource()
    .getFeatureInfoUrl(evt.coordinate, viewResolution, "EPSG:3857", {
      INFO_FORMAT: "application/json",
    });

  if (url) {
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.features.length > 0) {
          highlightSource.clear();
          let properties = data.features[0].properties;
          // const feature = new ol.format.GeoJSON().readFeature(
          //   data.features[0],
          //   {
          //     dataProjection: "EPSG:4326",
          //     featureProjection: "EPSG:3857",
          //   },
          // );

          // highlightSource.addFeature(feature);
          const coordinate = ol.proj.toLonLat(evt.coordinate);

          const wfsUrl = `
http://localhost:8080/geoserver/carbonGEO/ows?
service=WFS&
version=1.0.0&
request=GetFeature&
typeName=carbonGEO:post_district_emission&
outputFormat=application/json&
CQL_FILTER=INTERSECTS(geom, POINT(${coordinate[0]} ${coordinate[1]}))
`;
          fetch(wfsUrl)
            .then((res) => res.json())
            .then((wfsData) => {
              const features = new ol.format.GeoJSON().readFeatures(wfsData, {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              });
              highlightSource.addFeatures(features);
            });
          let table = `
      <h3>District Emission Data</h3>
      <table border="1" style="border-collapse:collapse; width:100%;">
        <tr>
          <th style="padding:6px;">Property</th>
          <th style="padding:6px;">Value</th>
        </tr>
    `;
          for (let key in properties) {
            if (
              key !== "geom" &&
              key !== "the_geom" &&
              !key.includes("stddev")
            ) {
              let value = properties[key];
              if (typeof value === "number") {
                value = classifyEmission(value);
              }
              table += `
        <tr>
          <td style="padding:6px;">${key}</td>
          <td style="padding:6px;">${value}</td>
        </tr>
      `;
            }
          }

          table += `</table>`;

          document.getElementById("info-panel").innerHTML = table;
        } else {
          console.log("No feature found");
        }
      });
  }
});

// ===============================
// FILTER (CQL)
// ===============================
function applyFilter() {
  wmsLayer.getSource().updateParams({
    CQL_FILTER: "co2_norm > 0.7",
    _refresh: Date.now(),
  });
}

// ===============================
// AUTO REFRESH (5 sec)
// ===============================
setInterval(() => {
  wmsLayer.getSource().updateParams({
    _refresh: Date.now(),
  });
}, 5000);

// ===============================
// TIME PARAMETER FUNCTION
// ===============================
function updateTime(dateString) {
  wmsLayer.getSource().updateParams({
    TIME: dateString,
    _refresh: Date.now(),
  });
}

// ===============================
// TIME SLIDER
// ===============================
const startDate = new Date("2025-01-01");

const slider = document.getElementById("timeSlider");

if (slider) {
  slider.addEventListener("input", function (e) {
    const days = parseInt(e.target.value);
    const newDate = new Date(startDate);
    newDate.setDate(startDate.getDate() + days);

    updateTime(newDate.toISOString());
  });
}

// ===============================
// STREAM FROM SERVER (NDJSON)
// ===============================
// Creates a vector layer and listens for NDJSON GeoJSON Features
const vectorSource = new ol.source.Vector();
const vectorLayer = new ol.layer.Vector({
  source: vectorSource,
});
map.addLayer(vectorLayer);

function startStream() {
  fetch("/stream")
    .then((res) => {
      if (!res.ok) {
        console.error("Stream endpoint returned", res.status, res.statusText);
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        console.error(
          "Stream endpoint returned HTML (check /stream in browser)",
        );
        return;
      }
      if (!res.body) {
        console.error("Streaming not supported by fetch response");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function pump() {
        return reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (buffer.trim()) {
                tryAddFeature(buffer);
              }
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n");
            buffer = parts.pop();
            for (const line of parts) {
              if (!line.trim()) continue;
              tryAddFeature(line);
            }
            return pump();
          })
          .catch((err) => console.error("Stream read error", err));
      }

      pump();
    })
    .catch((err) => console.error("Fetch stream error", err));
}

function tryAddFeature(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return;
  // ignore HTML error pages and other non-JSON lines
  if (trimmed[0] !== "{") {
    console.warn("Skipping non-JSON stream line");
    return;
  }
  try {
    const feat = JSON.parse(trimmed);
    if (!feat || !feat.geometry) return;
    const olFeat = new ol.format.GeoJSON().readFeature(feat, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    vectorSource.addFeature(olFeat);
  } catch (e) {
    console.error("Invalid feature", e, trimmed);
  }
}

// start automatically - stop or call on user action if desired
startStream();

