var huc10 = ee.FeatureCollection("USGS/WBD/2017/HUC10");

var region = ee.Geometry.Point([-82.55, 35.59]).buffer(100000);
var targetWatersheds = huc10.filterBounds(region);
Map.centerObject(targetWatersheds, 8);
Map.addLayer(targetWatersheds.style({
  color: 'black',
  fillColor: '00000000',
  width: 2
}), {}, 'All Watersheds (33 HUC10s)');

var dem = ee.Image("USGS/SRTMGL1_003");
var slope = ee.Terrain.slope(dem).clip(targetWatersheds);
var slopeSmoothed = slope.focal_mean({radius: 300, units: 'meters'});
var slopeNorm = slopeSmoothed.divide(30);  

Map.addLayer(slope, {min: 0, max: 30}, "Slope");

var nlcd = ee.ImageCollection("USGS/NLCD_RELEASES/2019_REL/NLCD")
            .filterDate('2016-01-01', '2016-12-31')
            .first()
            .select('landcover');

var landRisk = nlcd.remap(
  [21, 22, 23, 24, 81, 82, 41, 42, 43],
  [5, 5, 5, 5, 4, 4, 1, 1, 1]
).clip(targetWatersheds);

var landSmoothed = landRisk.focal_mean({radius: 300, units: 'meters'}).round();
var landNorm = landSmoothed.divide(5);

Map.addLayer(landRisk, {
  min: 1,
  max: 6,
  palette: ['#ccffcc', '#66ff66', '#ffff66', '#ff9933', '#ff3300', '#990099']
}, "Land Risk (Original)");
Map.addLayer(landSmoothed, {
  min: 1,
  max: 6,
  palette: ['#ccffcc', '#66ff66', '#ffff66', '#ff9933', '#ff3300', '#990099']
}, "Land Risk");

var chirpsRaw = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
                .filterDate('2024-09-25', '2024-09-28')
                .sum();

var chirpsSmooth = chirpsRaw
  .focal_mean({radius: 500, units: 'meters'})
  .focal_mean({radius: 300, units: 'meters'})
  .clip(targetWatersheds);

Map.addLayer(chirpsRaw.clip(targetWatersheds), {
  min: 220,
  max: 330,
  palette: [
    '#ffffe0', '#ffe066', '#ffcc33',
    '#ff9933', '#ff6600', '#ff3300', '#990099', '#660066'
  ]
}, 'Helene Rainfall');

var rainNorm = chirpsSmooth.subtract(220).divide(110);  

var transportRisk = slopeNorm.multiply(0.3)
                    .add(landNorm.multiply(0.4))
                    .add(rainNorm.multiply(0.3));

var transportSmoothed = transportRisk
  .focal_mean({radius: 650, units: 'meters'})
  .focal_mean({radius: 450, units: 'meters'});

var transportScaled = transportSmoothed.multiply(10);

Map.addLayer(transportScaled, {
  min: 0,
  max: 10,
  palette: [
    '#ccffcc',  // 0 light green
    '#66ff66',  // 1 green
    '#009933',  // 2 dark green
    '#ffff66',  // 3 yellow
    '#ffcc33',  // 4 dark yellow
    '#ff9933',  // 5 orange
    '#ff6600',  // 6 dark orange
    '#ff3300',  // 7 red
    '#990099',  // 8 purple
    '#000000'   // 9+ black
  ]
}, 'Transport Risk');

var transportBinned10 = transportSmoothed
  .where(transportSmoothed.lt(0.1), 1)
  .where(transportSmoothed.gte(0.1).and(transportSmoothed.lt(0.2)), 2)
  .where(transportSmoothed.gte(0.2).and(transportSmoothed.lt(0.3)), 3)
  .where(transportSmoothed.gte(0.3).and(transportSmoothed.lt(0.4)), 4)
  .where(transportSmoothed.gte(0.4).and(transportSmoothed.lt(0.5)), 5)
  .where(transportSmoothed.gte(0.5).and(transportSmoothed.lt(0.6)), 6)
  .where(transportSmoothed.gte(0.6).and(transportSmoothed.lt(0.7)), 7)
  .where(transportSmoothed.gte(0.7).and(transportSmoothed.lt(0.8)), 8)
  .where(transportSmoothed.gte(0.8).and(transportSmoothed.lt(0.9)), 9)
  .where(transportSmoothed.gte(0.9), 10);

Map.addLayer(transportBinned10, {
  min: 1,
  max: 10,
  palette: [
    '#ccffcc', '#66ff66', '#009933', '#ffff66', '#ffcc33',
    '#ff9933', '#ff6600', '#ff3300', '#990099', '#000000'
  ]
}, 'Transport Risk');

var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px'
  }
});

legend.add(ui.Label({
  value: 'Pollutant Transport Risk Legend',
  style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}
}));

var palette = [
  '#ccffcc', '#66ff66', '#009933', '#ffff66', '#ffcc33',
  '#ff9933', '#ff6600', '#ff3300', '#990099', '#000000'
];

var labels = [
  'Very Low', 'Low', 'Moderately Low', 'Moderate', 'Moderately High',
  'High', 'Very High', 'Severe', 'Extreme', 'Critical'
];

for (var i = 0; i < 10; i++) {
  var colorBox = ui.Label('', {
    backgroundColor: palette[i],
    padding: '8px',
    margin: '0 8px 4px 0'
  });

  var description = ui.Label(labels[i], {
    fontSize: '12px'
  });

  legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
}

Map.add(legend);
