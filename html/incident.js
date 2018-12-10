//
// Copyright 2018 Dan Ruderman (dlruderman2gmail.com)
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU Affero General Public License as published
//    by the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU Affero General Public License for more details.
//
//    You should have received a copy of the GNU Affero General Public License
//    along with this program.  If not, see https://www.gnu.org/licenses/.
//

console.log('Loading incident.js')

document.body.style.cursor = "wait"; // wait cursor

var currentRect = null; // make sure this is defined before anything else happens
// When a region is selected we need to empty out the name text, because they are
// not defining a new region. We also need to display the region on the map.
var regionSelector = $('#region-selector');
var drawnItems = new L.FeatureGroup(); // for rectangles the user draws
    

// put the version string in there
document.getElementById("app-version").innerHTML = VERSION;
    

// get all incidents and put them in the selector
function loadIncidents() {
    localDB.find({
	selector: {
	    type: 'incident',
	    id: {$ne: ''} // Don't know why this is needed, but it fails with search for type:'incident' alone
	}
    }).then(function(result) {
	    var docs = result.docs;

	console.log("Found " + result.docs.length + " incidents");

	// comparison by creation date
	var compare = function(o1, o2) {
	    if(o1.creation_time_ms > o2.creation_time_ms)
		return -1;
	    else if(o1.creation_time_ms < o2.creation_time_ms)
		return 1;
	    else
		return 0;
	}

	if(docs.length > 0) {
	    docs.sort(compare); // sort with most recent on top
	    
	    for(var i=0; i < docs.length; i++) {
		var incident = docs[i].contents.label;
		var desc = docs[i].contents.desc;
		if(desc === undefined) desc = "";
		var html = '<option value="' + incident + '">' + incident + ":&nbsp;" + desc + '</option>';
		$('#incident-selector').append(html);
	    }
	}

    }).catch(function(err) {
	console.log(err);
    });
}
// get all regions and put them in the selector
function loadRegions() {
    localDB.find({
	selector: {
	    type: 'region',
	    id: {$ne: ''}
	}
    }).then(function(result) {
	    var docs = result.docs;

	console.log("Found " + result.docs.length + " regions");
	
	for(var i=0; i < docs.length; i++) {
	    var region = docs[i].contents.label;
	    var html = '<option value="' + region + '">' + region + '</option>';
	    $('#region-selector').append(html);
	}

    }).catch(function(err) {
	console.log(err);
    });
}

async function validateNewIncidentForm(e) {
    var queryResult;
    
    // make sure any new region name doesn't already exist
    var newRegionName = $('#region-name').val().trim();
    if(newRegionName != '') {
	queryResult = await localDB.find({'selector':
					  {'type': 'region',
					   'contents.label': newRegionName}});
	
	
	if(queryResult.docs.length > 0) {
	    $('#region-name').focus();
	    alert("Region '" + newRegionName + "' already exists. Try another name.");
	    return false; // interrupt submit action
	}
    }
    
    // make sure incident name doesn't already exist
    var newIncidentName = $('#new-incident-name').val().trim();
    
    queryResult = await localDB.find({'selector':
				      {'type': 'incident',
				       'contents.label': newIncidentName}});
    
    if(queryResult.docs.length > 0) {
	$('#new-incident-name').focus();
	alert("Incident '" + newIncidentName + "' already exists. Try another name.");
	return false; // interrupt submit action
    }
    
    // OK - create new region if needed. Get region as a layer off the map
    if(newRegionName != '') {
	var regionName = newRegionName;
	
	// get the drawn rectangle coords
	var layers = drawnItems.getLayers();
	
	if(layers.length == 0) {
	    alert("Need to define a new rectangular region on the map by clicking on the black square icon on the map's left side.");
	    return false;
	}
	
	// TODO: this computation won't work if you cross the 180 deg meridian because the signs flip.
	// Probaby will have trouble at the poles too
	var bounds = layers[0]._bounds;
	var ne = bounds._northEast;
	var sw = bounds._southWest;
	
	// create new region
	var region = createRegionDoc((ne.lat+sw.lat)/2, (ne.lng+sw.lng)/2, ne.lat-sw.lat, ne.lng-sw.lng,
				     newRegionName, "Region created for incident " + newIncidentName);
	
	// create new incident
	
	try {
	    await localDB.put(region);
	} catch (err) {
	    console.log(err);
	    alert(err);
	}
    } else {
	var regionName = $('#region-selector').val();
	if(regionName == null) {
	    alert("Must either select a region or define a new one.");
	    return false;
	}
    }

    var start_time_text = $('#incident-start').val();
    var start_time_ms = moment(start_time_text, "MM/DD/YYYY HH:mm", true).unix()*1000;
    var end_time_text = $('#incident-end').val();
    if(end_time_text == '') {
	var end_time_ms = null; // ongoing event
    } else {
	var end_time_ms = moment(end_time_text, "MM/DD/YYYY HH:mm", true).unix()*1000;

	if(end_time_ms <= start_time_ms) {
	    alert("End time of incident must be after start time of incident");
	    return false;
	}
    }

    var incident = createIncidentDoc(newIncidentName, $('#incident-desc').val().trim(), start_time_ms, end_time_ms, regionName);
    
    try {
	await localDB.put(incident);
    } catch (err) {
	console.log(err);
	alert(err);
    }

    
    sessionStorage.setItem(CURRENT_INCIDENT_ID, newIncidentName);

    window.location = "emcommap.html"; // load the emcommap
}

// if they press a key in the region name, unselect the region selector
$('#region-name').keypress(function(e) {
    $('#region-selector').val([]);

    if(currentRect != null) { // there's a region rectangle up
	// erase it
	currentRect.removeFrom(mymap);
	
	currentRect = null;
    }
});

// log out button
$('#logout-button').click(function() {
    if(confirm("Log out?")) {
	// clear the saved values
	sessionStorage.removeItem(USERNAME_ID);
	sessionStorage.removeItem(PASSWORD_ID);

	window.location = "index.html"; // go back to login page
    }
});

function validateSelectIncidentForm(e) {
    // get selected incident and store
    var incident =$('#incident-selector').val();
    console.log("Selected incident: " + incident);
    
    sessionStorage.setItem(CURRENT_INCIDENT_ID, incident);

    window.location = "emcommap.html"; // load the emcommap
}

//
// Main app
//
function main_app() {
    document.body.style.cursor = "default";

    console.log("Running main app.");
    console.log(sessionStorage); // show what is stored

    loadIncidents();
    loadRegions();

    // enable GUI
    document.getElementById("incident-selector").disabled = false;
    document.getElementById("show-button").disabled = false;
    document.getElementById("create-button").disabled = false;
    document.getElementById("region-selector").disabled = false;
    
    // set up date time fields
    $('#incident-start').datetimepicker();
    $('#incident-end').datetimepicker();
    $('#incident-start').val(moment().format('MM/DD/YYYY HH:mm')); // default to current time
    
    regionSelector.change(function() {
	if(regionSelector.find(":selected").index() == 0) return; // somehow selected the instruction item at the top of the list

	// remove any existing drawn rectangle from the map
	drawnItems.clearLayers();
	
	// blank out the name text because they can only either select a region *or* define one
	$('#region-name').val('');

	// get the region label, query the region, and load it into the map
	var regionLabel = regionSelector.find(":selected").val();

	localDB.find({'selector': {'type': 'region', 'contents.label': regionLabel}}).then(function(result) {
	    numFound = result.docs.length;
	    
	    if(numFound != 1) {
		console.log("Found " + numFound + " regions named " + regionLabel + ". Expected 1.");
	    } else {
		region = result.docs[0];

		if(currentRect != null) mymap.removeLayer(currentRect);
		
		setMapViewToRegion(region);
		var bounds = getBoundsForRegion(region);
		currentRect = L.rectangle(bounds, {color: 'red', fill: false}).addTo(mymap); // show the bounds for the selected region
	    }
	}).catch(function(err) {
	    console.log(err);
	});
    });

    // add a way for user to define rectangles on the map by dragging
    mymap.addLayer(drawnItems);

    var drawControl = new L.Control.Draw({
	'draw': {
            'rectangle': true,
            'polygon': false,
            'polyline': false,
            'circle': false,
            'marker': false
	},
	'edit': {
            'featureGroup': drawnItems
        }
	
    });
    drawControl.setDrawingOptions({
	rectangle: {
    	    shapeOptions: {
		color: '#FF0000', // red
		opacity: 1,
		fill: false // not filled
            }
	}
    });
    mymap.addControl(drawControl);

    // what to do when a new rect done being created
    mymap.on(L.Draw.Event.CREATED, function (e) {
	drawnItems.addLayer(e.layer); // add it into our feature group
    });

    // only allow one rectangle at a time
    mymap.on(L.Draw.Event.DRAWSTART, function(e) {
	// clear feature group
	drawnItems.clearLayers();

	if(currentRect != null) { // there's already a region rectangle up
	    // erase it
	    currentRect.removeFrom(mymap);
	    
	    currentRect = null;
	}

	// nothing selected anymore in region seklector
	$("#region-selector").val([]);
    });

}

if(db_sync_complete) {
    console.log("db sync already complete");
    main_app(); // start main app 
} else {
    console.log("awaiting db sync");
    sync_complete_callback = main_app;
}

