// https://www.highcharts.com/
import Highcharts from 'highcharts';
import 'highcharts/modules/map';
import 'highcharts/modules/accessibility';
import 'highcharts/modules/exporting';
import 'highcharts/modules/export-data';
import 'highcharts/modules/pattern-fill';

// https://www.npmjs.com/package/uuid4
import { v4 as uuidv4 } from 'uuid';

const MapChart = () => {
  (async () => {
    let map;
    const data_path = `${(window.location.href.includes('unctad.org')) ? 'https://storage.unctad.org/2025-tariffs_updated/' : (window.location.href.includes('localhost:80')) ? './' : 'https://unctad-infovis.github.io/2025-tariffs_updated/'}assets/data/`;

    // Fetch the topology
    const topology = await fetch(`${data_path}worldmap-economies-54030.topo.json`).then(response => response.json());

    // Fetch the user-specific data and settings files
    const data = (await fetch(`${data_path}data.json?v=${uuidv4()}`).then(response => response.json()))
      .map(d => ({ ...d, code: String(d.code) }));
    window.mapData = data;

    const settings = await fetch(`${data_path}settings.json`).then(response => response.json());

    const allValues = data.map(d => parseFloat(d.value)).filter(v => !Number.isNaN(v));
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    const bubbleMap = true;

    // Helper function to convert hex color to RGB
    function hexToRgb(hex) {
      let r = 0;
      let g = 0;
      let b = 0;

      if (hex.length === 4) { // 3 digits
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
      } else if (hex.length === 7) { // 6 digits
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
      }
      return { r, g, b };
    }

    // Helper function to convert RGB to hex color
    function rgbToHex(r, g, b) {
      // eslint-disable-next-line no-bitwise
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // Define a color mapping function based on value (special cases dealt with by getColor)
    function getColorFromValue(value) {
      // Return grey if value is null, NaN, or undefined
      if (value === null || value === undefined || Number.isNaN(value)) {
        return '#DDDDDD';
      }

      // Check if the mode is continuous
      if (settings.non_dw.colorscale.mode === 'continuous') {
        // Find the closest two stops around the value
        let lowerStop = null;
        let upperStop = null;

        for (let i = 0; i < settings.non_dw.colorscale.colors.length; i++) {
          const stop = settings.non_dw.colorscale.colors[i];
          if (stop.position <= value) {
            lowerStop = stop;
          } else {
            upperStop = stop;
            break;
          }
        }

        // If both stops are found, interpolate between them
        if (lowerStop && upperStop) {
          const range = upperStop.position - lowerStop.position;
          const valueRatio = (value - lowerStop.position) / range;
          const lowerColor = lowerStop.color;
          const upperColor = upperStop.color;

          // Interpolate color (simple linear interpolation for RGB)
          const lowerRGB = hexToRgb(lowerColor);
          const upperRGB = hexToRgb(upperColor);
          const interpolatedRGB = {
            r: Math.round(lowerRGB.r + valueRatio * (upperRGB.r - lowerRGB.r)),
            g: Math.round(lowerRGB.g + valueRatio * (upperRGB.g - lowerRGB.g)),
            b: Math.round(lowerRGB.b + valueRatio * (upperRGB.b - lowerRGB.b)),
          };

          return rgbToHex(interpolatedRGB.r, interpolatedRGB.g, interpolatedRGB.b);
        }

        // If value is below the first stop, return the color of the first stop
        if (lowerStop) {
          return lowerStop.color;
        }

        // If value is above the last stop, return the color of the last stop
        if (upperStop) {
          return upperStop.color;
        }
      }

      // If not continuous, fall back to discrete handling
      for (let i = 0; i < settings.non_dw.colorRanges.length; i++) {
        const range = settings.non_dw.colorRanges[i];
        // Use a large negative value if `fromValue` is null (representing the minimum range)
        const fromValue = range.fromValue === null ? -Infinity : range.fromValue;
        // Use a large positive value if `toValue` is null (representing the maximum range)
        const toValue = range.toValue === null ? Infinity : range.toValue;
        // Check if value falls within the current range
        if (value >= fromValue && value <= toValue) {
          return range.color;
        }
      }

      return '#DDDDDD'; // Default color if no range matches
    }

    // Define a color mapping function based on value **and code**
    function getColor(value, code) {
      const AksaiChin = 'C00002'; // code for disputed area Aksai Chin
      const Kosovo = '412'; // code for Kosovo

      // First check if this code is special
      if (code === AksaiChin) {
        const kashmirData = data.find(item => item.code === 'C00007'); // Find kashmir in data
        const kashmirValue = kashmirData ? kashmirData.value : null; // Get kashmir's value, default to null
        const chinaData = data.find(item => item.code === '156'); // Find china in data
        const chinaValue = chinaData ? chinaData.value : null; // Get china's value, default to null
        return {
          pattern: {
            path: {
              d: 'M 0 10 L 10 0 M -1 1 L 1 -1 M 9 11 L 11 9',
              strokeWidth: 2.5 * Math.sqrt(2),
            },
            width: 10, // Width of the pattern
            height: 10, // Height of the pattern
            color: getColorFromValue(chinaValue),
            backgroundColor: getColorFromValue(kashmirValue),
          }
        };
      }
      // First check if this code is special
      if (code === Kosovo) {
        const serbiaData = data.find(item => item.code === '688'); // Find Serbia in data
        const serbiaValue = serbiaData ? serbiaData.value : null; // Get Serbia's value, default to null

        return getColorFromValue(serbiaValue);
      }

      return getColorFromValue(value);
    }

    // Prepare a mapping of code -> labelen, labelfr from topology
    const labelMap = topology.objects.economies.geometries.reduce((mapLabel, geometry) => {
      const { code, labelen, labelfr } = geometry.properties; // Extract properties from geometry
      mapLabel[code] = { labelen, labelfr }; // Map code to labelen and labelfr
      return mapLabel;
    }, {});
    // Manually insert European Union label
    labelMap['918'] = {
      labelen: 'European Union',
      labelfr: 'Union européenne'
    };

    // Extract the transformation values from the TopoJSON
    const { scale } = topology.transform;
    const { translate } = topology.transform;

    // Extract and transform the point coordinates for 'economies-point'
    const coordinatesMap = topology.objects['economies-point'].geometries.reduce((mapCoordinates, geometry) => {
      const [x, y] = geometry.coordinates; // Original projected coordinates

      // Apply inverse transformation (reverse scaling and translation)
      const lon = x * scale[0] + translate[0];
      const lat = y * scale[1] + translate[1];

      const economyCode = geometry.properties.code;
      mapCoordinates[economyCode] = { lon, lat }; // Map code to coordinates
      return mapCoordinates;
    }, {});
    coordinatesMap['918'] = {
      lon: 69042 * scale[0] + translate[0],
      lat: 64101 * scale[1] + translate[1]
    };

    function processTopoObject(topologyObject, objectName) {
      // Create a deep clone of the topology object
      const topologyClone = JSON.parse(JSON.stringify(topologyObject));

      const { arcs: topologyArcs, transform } = topologyClone;

      // Function to decode an individual arc (handles negative indices)
      function decodeArc(index) {
        // Get the arc based on index
        // eslint-disable-next-line no-bitwise
        const arc = topologyArcs[index < 0 ? ~index : index]; // If index is negative, flip and get arc

        // Start with the first point, which is absolute (e.g., [0, 0] or the first point in the arc)
        const currentPoint = arc[0]; // The first point is absolute, not a delta

        // Convert from projected coordinates to latitude/longitude using the transform
        const decodedArc = arc.map(([dx, dy], idx) => {
          // If it's not the first point, apply the delta to the previous point
          if (idx !== 0) {
            currentPoint[0] += dx; // Cumulative change in x
            currentPoint[1] += dy; // Cumulative change in y
          }

          // // Apply the transformation to convert from projected to lat/lon
          // return [
          //   currentPoint[0] * transform.scale[0] + transform.translate[0],
          //   currentPoint[1] * transform.scale[1] + transform.translate[1]
          // ];
          const coordinateScaleFactor = 1 / 100000;
          return [
            (currentPoint[0] * transform.scale[0] + transform.translate[0]) * coordinateScaleFactor,
            (currentPoint[1] * transform.scale[1] + transform.translate[1]) * coordinateScaleFactor
          ];
        });

        // If the original index was negative, reverse the decoded arc
        return index < 0 ? decodedArc.reverse() : decodedArc;
      }

      // Access the specified object in the topology
      const topoObject = topologyClone.objects[objectName];
      if (!topoObject) {
        console.error(`Object "${objectName}" not found in topology.`);
        return [];
      }

      // Process the geometries in the specified object
      const processedGeometries = topoObject.geometries.map(geometry => {
        const decodedCoordinates = geometry.arcs.map(arcSet => {
          // Decode arcs for LineString or MultiLineString
          if (Array.isArray(arcSet)) {
            return arcSet.map(arcIndex => decodeArc(arcIndex));
          }
          return decodeArc(arcSet);
        });

        // Combine all decoded arcs into a MultiLineString
        const multiLineCoordinates = decodedCoordinates.flat();

        return {
          geometry: {
            type: geometry.type,
            coordinates: geometry.type === 'LineString'
              ? decodedCoordinates[0] // Flatten for LineString
              : multiLineCoordinates // Combined MultiLineString
          },
          properties: geometry.properties
        };
      });

      return processedGeometries;
    }

    const plainborders = processTopoObject(topology, 'plain-borders');
    const dashedborders = processTopoObject(topology, 'dashed-borders');
    const dottedborders = processTopoObject(topology, 'dotted-borders');
    const dashdottedborders = processTopoObject(topology, 'dash-dotted-borders');

    // process polygons objects
    function processTopoObjectPolygons(topologyObjectPolygons, objectName) {
      // Create a deep clone of the topology object
      const topologyClone = JSON.parse(JSON.stringify(topologyObjectPolygons));

      const { arcs: topologyArcs, transform } = topologyClone;

      // Function to decode an individual arc (handles negative indices)
      function decodeArc(index) {
        // Get the arc based on index
        // eslint-disable-next-line no-bitwise
        const arc = topologyArcs[index < 0 ? ~index : index]; // If index is negative, flip and get arc

        // Create a copy of the arc to avoid side effects
        const currentPoint = [...arc[0]]; // Clone the first point
        const arcCopy = arc.map(([dx, dy]) => [dx, dy]); // Deep copy the arc

        // Convert from projected coordinates to latitude/longitude using the transform
        const decodedArc = arcCopy.map(([dx, dy], idx) => {
          if (idx !== 0) {
            currentPoint[0] += dx; // Cumulative change in x
            currentPoint[1] += dy; // Cumulative change in y
          }

          // Apply the transformation to convert from projected to lat/lon
          // return [
          //   currentPoint[0] * transform.scale[0] + transform.translate[0],
          //   currentPoint[1] * transform.scale[1] + transform.translate[1]
          // ];
          const coordinateScaleFactor = 1 / 100000;
          return [
            (currentPoint[0] * transform.scale[0] + transform.translate[0]) * coordinateScaleFactor,
            (currentPoint[1] * transform.scale[1] + transform.translate[1]) * coordinateScaleFactor
          ];
        });

        // If the original index was negative, reverse the decoded arc
        return index < 0 ? decodedArc.reverse() : decodedArc;
      }

      // Access the specified object in the topology
      const topoObject = topologyClone.objects[objectName];
      if (!topoObject) {
        console.error(`Object "${objectName}" not found in topology.`);
        return [];
      }

      // Process the geometries in the specified object
      const processedGeometries = topoObject.geometries
        // .filter(geometry => ["604", "250", "398", "352"].includes(geometry.properties.code)) // Filter for multiple codes
        .map(geometry => {
          const decodedCoordinates = geometry.arcs.map(arcSet => {
            if (Array.isArray(arcSet[0])) {
              // MultiPolygon
              return arcSet.map(subArcSet => subArcSet.flatMap(decodeArc));
            }
            // Polygon
            return arcSet.flatMap(decodeArc);
          });
          return {
            geometry: {
              type: geometry.type,
              coordinates: geometry.type === 'Polygon'
                ? decodedCoordinates
                : decodedCoordinates
            },
            properties: geometry.properties
          };
        });

      return processedGeometries;
    }

    const economiescolor = processTopoObjectPolygons(topology, 'economies-color');
    const economies = processTopoObjectPolygons(topology, 'economies');

    // Function to create mapline series
    function createMaplineSeries(name, mapData, dashStyle) {
      return {
        dashStyle,
        mapData: mapData.map(border => ({
          geometry: border.geometry,
          name: border.properties.code,
        })),
        name,
        states: {
          hover: {
            borderColor: '#ee0505',
            borderWidth: 2
          },
          inactive: {
            borderColor: '#ee0505',
            borderWidth: 0,
            enabled: false
          }
        },
        type: 'mapline'
      };
    }

    let selectedtariff_structure = 1;
    // let tariff_structureInterval = null; // to hold the interval for play functionality

    function generateBubbleData(tariff_structure) {
      return Object.entries(coordinatesMap).map(([code, coords]) => {
        const match = data.find(row => row.code === code && row.tariff_structure === tariff_structure);
        const value = match ? parseFloat(match.value) : null;
        const labelen = labelMap[code]?.labelen || code;
        const devStatus = match?.dev_status;

        // Assign color by development status
        let bubbleColor = '#999'; // default fallback
        // if (devStatus === 'Developed') bubbleColor = '#c5dfef'; //"#7BB7E1"; //
        // else if (devStatus === 'Developing') bubbleColor = '#004987';
        // else if (devStatus === 'Least developed') bubbleColor = '#fbaf17';
        if (devStatus === 'Developed') bubbleColor = '#004987'; // '#c5dfef' //"#7BB7E1" // 'rgba(197, 223, 239, 1)';
        else if (devStatus === 'Developing') bubbleColor = '#009edb'; // 'rgba(0, 73, 135, 1)';
        else if (devStatus === 'Least developed') bubbleColor = '#FBAF17'; // 'rgba(251, 175, 23, 1)';

        return {
          code,
          color: bubbleColor,
          cursor: 'pointer',
          lat: coords.lat / 100000,
          lineWidth: 0,
          lon: coords.lon / 100000,
          marker: {
            lineColor: bubbleColor,
            states: {
              hover: {
                halo: {
                  size: 0
                },
                lineWidthPlus: 4,
                marker: {
                },
                opacity: 1
              },
              normal: {
                opacity: 0.7
              }
            }
          },
          name: labelen,
          value,
          z: value
        };
      });
    }

    function updateMapFortariff_structure(tariff_structure) {
      // Update the first layer (economiescolor) using getColor
      const newDataLayer1 = economiescolor.map(region => {
        const { code } = region.properties;
        // Filter data by code and the selected tariff_structure
        const match = data.find(row => row.code === code && row.tariff_structure === tariff_structure);
        const value = match ? parseFloat(match.value) : null;
        // Lookup a human-readable label using labelMap; fallback to code if not found
        const labelen = labelMap[code]?.labelen || code;

        return {
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: 0,
          color: bubbleMap ? '#dad4d0' : getColor(value, code), // Compute color dynamically
          geometry: region.geometry,
          name: labelen, // Tooltip will display this label
          value
        };
      });

      // Update the second layer (economies) with always-transparent fill
      const newDataLayer2 = economies.map(region => {
        const { code } = region.properties;
        // Filter data by code and tariff_structure
        const match = data.find(row => row.code === code && row.tariff_structure === tariff_structure);
        const value = match ? parseFloat(match.value) : null;
        const labelen = labelMap[code]?.labelen || code;

        return {
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: 0,
          color: 'rgba(0, 0, 0, 0)', // Always transparent
          geometry: region.geometry,
          name: labelen,
          value
        };
      });

      // Update both series in the Highcharts map.
      // Series[0] is for economiescolor and series[1] is for economies (tooltip).
      map.series[0].setData(newDataLayer1, false);
      map.series[1].setData(newDataLayer2, true); // true forces immediate redraw
      map.series[6].setData(generateBubbleData(selectedtariff_structure), true, {
        duration: 6000,
        easing: 'easeOutQuad'
      }); // Update bubbles

      // Update tariff_structure display and slider
      // document.getElementById('currenttariff_structure').innerText = tariff_structure;
      document.getElementById('tariff_structureSlider').value = tariff_structure;
    }

    // Slider change handler
    document.getElementById('tariff_structureSlider').addEventListener('input', (event) => {
      selectedtariff_structure = parseInt(event.target.value, 10); // Set the selected tariff_structure from the slider
      updateMapFortariff_structure(selectedtariff_structure); // Update the map with the selected tariff_structure
    });

    // generate bubbleData to start with
    const bubbleData = generateBubbleData(selectedtariff_structure);

    // Create the chart
    Highcharts.setOptions({
      lang: {
        decimalPoint: '.',
        downloadCSV: 'Download CSV data',
        thousandsSep: ','
      }
    });
    map = Highcharts.mapChart('map_container', {
      caption: {
        align: 'left',
        margin: 15,
        style: {
          color: 'rgba(0, 0.0, 0.0, 0.8)',
          fontSize: '13px'
        },
        text: '<em>Source:</em> UN Trade and Development (UNCTAD) based on UN Comtrade, UNCTAD TRAINS and Presidential actions, including the Executive Orders published by the White House.<br /><em>Note:</em> Trade weights for the year 2023. Data as of 18 June 2025. <a href="https://unctad.org/page/map-disclaimer" target="_blank">Map disclaimer</a>',
        useHTML: true,
        verticalAlign: 'bottom',
        x: 0
      },
      chart: {
        height: Math.max((document.getElementById('map_container').offsetWidth * 9) / 16, 400),
        backgroundColor: '#f4f9fd',
        events: {
          load() {
            // const chart_this = this;
            // chart_this.renderer.image('https://static.dwcdn.net/custom/themes/unctad-2024-rebrand/Blue%20arrow.svg', 20, 15, 44, 43.88).add();
          }
        },
        type: 'map'
      },
      colorAxis: {
        dataClasses: [
          {
            color: '#004987', // "#c5dfef", //"#7BB7E1", //
            from: 0,
            name: 'Developed',
            to: 0,
            value: 'Developed'
          },
          {
            color: '#009edb', // "#004987",
            from: 0,
            name: 'Developing',
            to: 0,
            value: 'Developing'
          },
          {
            color: '#fbaf17',
            from: 0,
            name: 'Least developed',
            to: 0,
            value: 'Least developed'
          }
        ]
      },
      credits: {
        enabled: false
      },
      exporting: {
        enabled: false
      },
      legend: {
        align: 'left',
        enabled: true,
        events: {
          itemClick() {
            return false;
          }
        },
        itemDistance: 10,
        itemStyle: {
          cursor: 'default',
          fontSize: '15px',
          fontWeight: 400
        },
        verticalAlign: 'top'
      },
      mapNavigation: {
        buttonOptions: {
          verticalAlign: 'bottom'
        },
        enabled: true
      },
      plotOptions: {
        series: {
          tooltip: {
            enabled: false
          }
        },
        mapbubble: {
          animation: false,
          states: {
            hover: {
              enabled: true,
              halo: {
                size: 0
              }
            }
          },
          tooltip: {
            enabled: false
          }
        },
        map: {
          tooltip: {
            enabled: false
          }
        },
        mapline: {
          borderWidth: settings.non_dw.lineWidth,
          color: '#fff',
          lineWidth: settings.non_dw.lineWidth,
          tooltip: {
            enabled: false
          }
        }
      },
      responsive: {
        rules: [{
          chartOptions: {
            title: {
              style: {
                fontSize: '26px',
                lineHeight: '30px'
              }
            }
          },
          condition: {
            maxWidth: 500
          }
        }]
      },
      series: [
        {
          data: economiescolor.map(region => {
            const match = data.find(row => row.code === region.properties.code);
            const value = match ? parseFloat(match.value) : null;
            const { code } = region.properties; // Store region code
            const labelen = labelMap[code]?.labelen || code;
            return {
              borderColor: 'rgb(238, 5, 5)',
              borderWidth: 0,
              color: getColor(value, code),
              geometry: region.geometry,
              name: labelen,
              value
            };
          }),
          enableMouseTracking: false,
          name: 'Economies-colour',
          states: {
            hover: {
              borderColor: '#ee0505',
              borderWidth: 2
            },
            inactive: {
              borderColor: '#ee0505',
              borderWidth: 0,
              enabled: false
            }
          },
          type: 'map'
        },
        {
          data: economies.map(region => {
            const match = data.find(row => row.code === region.properties.code);
            const value = match ? parseFloat(match.value) : null;
            const { code } = region.properties; // Store region code
            const labelen = labelMap[code]?.labelen || code;
            return {
              borderColor: 'rgba(0, 0, 0, 0)',
              borderWidth: 0,
              color: 'rgba(0, 0, 0, 0)',
              geometry: region.geometry,
              name: labelen,
              value
            };
          }),
          enableMouseTracking: true,
          name: 'Economies',
          states: {
            hover: {
              borderColor: 'rgba(0, 0, 0, 0)',
              borderWidth: 2
            }
          },
          type: 'map',
          visible: !bubbleMap
        },
        // Using the function to create mapline series
        createMaplineSeries('Dashed Borders', dashedborders, 'Dash'),
        createMaplineSeries('Dotted Borders', dottedborders, 'Dot'),
        createMaplineSeries('Dash Dotted Borders', dashdottedborders, 'DashDot'),
        createMaplineSeries('Plain Borders', plainborders, 'Solid'),
        {
          animation: {
            duration: 600,
            easing: 'easeOutQuad' // Optional: 'easeOutBounce', 'easeInOutCubic', etc.
          },
          data: bubbleData,
          joinBy: null,
          maxSize: '8%',
          minSize: 0,
          name: 'Average Tariff Rate',
          marker: {
            fillOpacity: 1
          },
          type: 'mapbubble',
          visible: bubbleMap,
          zMax: maxValue,
          zMin: minValue
        },
      ],
      subtitle: {
        enabled: true,
        minScale: 1,
        style: {
          color: 'rgba(0, 0, 0, 0.8)',
          fontSize: '16px',
          fontWeight: 400,
          lineHeight: '18px'
        },
        // text: '<div style="margin-right: 64px">Trade-weighted applied tariffs on US imports if all new tariffs, including country-specific ones, are applied</div>',
        text: null,
        useHTML: true,
        x: 64
      },
      tooltip: {
        enabled: true,
        headerFormat: '',
        pointFormat: '<strong>{point.name}</strong><br />{point.z:.1f}%',
        style: {
          color: '#000',
          fontSize: '15px'
        }
      },
      title: {
        align: 'left',
        minScale: 1,
        style: {
          color: '#000',
          fontSize: '30px',
          fontWeight: 700,
          lineHeight: '34px'
        },
        // text: '<div style="margin-right: 64px">Planned US tariffs are disruptively high for many vulnerable economies</div>',
        text: null,
        useHTML: true,
        x: 64,
        y: 25
      },
    });

    // Initialize map with the selected tariff_structure (on page load or reset)
    updateMapFortariff_structure(selectedtariff_structure);
  })();
};

export default MapChart;
