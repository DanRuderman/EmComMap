//
// Copyright 2018 Dan Ruderman (dlruderman2gmail.com)
//

console.log('Loading map.js')

var selectedLocation = '';


var mymap = L.map('mapid').setView([34.065, -118.253], 10); // start in LA

// load some icons
var greenCircleIcon = L.icon({iconUrl: 'css/images/green_circle.png', iconAnchor: [25, 25]});
var greenCircleIconAnimated = L.icon({iconUrl: 'css/images/green_circle.png',
				      iconAnchor: [25, 25], className: 'highlight-marker'});


L.control.scale().addTo(mymap);

var tileServerURL = sessionStorage.getItem(MAP_SERVER_ID);

L.tileLayer(tileServerURL, TILE_SERVER_OPTS).addTo(mymap);

// returns [[min_lat, min_lon], [max_lat, max_lon]]
function getBoundsForRegion(region) {
    var contents = region.contents;
    var lat = contents.lat; // center
    var lon = contents.lon; // center
    var lat_span = contents.lat_span;
    var lon_span = contents.lon_span;

    var min_lat = lat - lat_span/2;
    var max_lat = lat + lat_span/2;
    var min_lon = lon - lon_span/2;
    var max_lon = lon + lon_span/2;
    
    // Now set the map to that region with a bit of a buffer
    var corner1 = [min_lat, min_lon];
    var corner2 = [max_lat, max_lon];

    return([corner1, corner2]);
}


function setMapViewToRegion(region) {
    mymap.fitBounds(getBoundsForRegion(region));
}


// show a marker that blinks and then vanishes at the given location
function animateHighlightMarkerAt(lat, lon) {
    var marker = L.marker([lat, lon], {
	icon: greenCircleIconAnimated
    });

    marker.addTo(mymap);

    // remove marker in 2 sec
    setTimeout(function() {
	mymap.removeLayer(marker);
    }, 2000);
}

// return the marker
function showHighlightMarkerAt(lat, lon) {
    var marker = L.marker([lat, lon], {
	icon: greenCircleIcon
    });

    marker.addTo(mymap);

    return marker;
}

