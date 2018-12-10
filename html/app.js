//
// Copyright 2018 Dan Ruderman (dlruderman@gmail.com)
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

console.log('Loading app.js')

document.body.style.cursor = "wait"; // wait cursor

// first load the current incident and region
var selectedLocationLabel = null; // the last location that was clicked on
var lastSelectedLocationDisplayedInfo = "";
var currentIncident; // the document for the current incident
var currentRegion;
var currentRegionBounds;
var tacticalCall = sessionStorage.getItem(TACTICAL_CALL_ID); // null if not set
if(tacticalCall===undefined || tacticalCall == null || tacticalCall == "" || tacticalCall == "null") {
    sessionStorage.setItem(TACTICAL_CALL_ID, null);
    tacticalCall = null;
} else {
    tacticalCall = tacticalCall.toLowerCase(); // ensure lower case
}

var locationsByLabel = {}; // locations we know about, keyed by label
var locationsByID = {}; // locations we know about, keyed by document ID. Useful for when they are deleted
var markerByCallsign = {}; // keep track of existing markers for operators
var markerByLocationLabel = {}; // keep track of existing markers for locations
var circleByLocationLabel = {}; // keep track of existing circles for locations
var statusByOperator = {}; // keep track of operator status by callsign
var incidentByLabel = {}; // keep track of incidents

// define icon locations
government_icon_file = 'css/images/government.png';
hospital_icon_file = 'css/images/hospital.png';
ICP_icon_file = 'css/images/icp_icon.png';
police_icon_file = 'css/images/badge_outline.png';
operator_icon_file = 'css/images/operator.png';
fire_icon_file = 'css/images/fire_icon.png';
incident_icon_file = 'css/images/incident.png';
marker_icon_file = 'css/images/marker-icon.png';

// load some icons
var government_icon = L.icon({iconUrl:government_icon_file, iconAnchor:[14,14]});
var hospital_icon = L.icon({iconUrl:hospital_icon_file, iconAnchor:[9,10]});
var ICP_icon = L.icon({iconUrl:ICP_icon_file, iconAnchor:[13,13]});
var police_icon = L.icon({iconUrl:police_icon_file, iconAnchor:[10,11]});
var operator_icon = L.icon({iconUrl:operator_icon_file, iconAnchor:[10,15]});
var fire_icon = L.icon({iconUrl:fire_icon_file, iconAnchor:[14,14]});
var incident_icon = L.icon({iconUrl:incident_icon_file, iconAnchor:[14,11]});
var marker_icon = L.icon({iconUrl:marker_icon_file, iconAnchor:[13,20]});

var icon_and_file_by_type = {
    'hospital': { 'icon': hospital_icon, 'file': hospital_icon_file },
    'ICP': { 'icon': ICP_icon, 'file': ICP_icon_file },
    'police': { 'icon': police_icon, 'file': police_icon_file },
    'fire': { 'icon': fire_icon, 'file': fire_icon_file },
    'incident': { 'icon': incident_icon, 'file': incident_icon_file },
    'government': { 'icon': government_icon, 'file': government_icon_file },
    'other': { 'icon': marker_icon, 'file': marker_icon_file }
};

var location_types = Object.keys(icon_and_file_by_type); // all the location types we know about
var hidden_location_types = []; // keep track of which layers we are hiding

function set_class_of_all_checboxes_in_layer_to(layer_type, class_name) {
    var array = checkbox_arrays_by_location_type[layer_type];
    for(var i=0; i < array.length; i++) {
	array[i].setAttribute('class', class_name);
    }
}

var layer_groups_by_html = {};
var layer_groups_by_type = {};
function create_add_remove_function(layer_type, add) {
    return function(e) {
	set_class_of_all_checboxes_in_layer_to(layer_type,
					       add ? 'displayed-location-checkbox-label' :
					       'hidden-location-checkbox-label');

	if(!add) {
	    hidden_location_types.push(layer_type); // add to our array of hidden location types
	} else {
	    hidden_location_types = hidden_location_types.filter(function(obj) {
		return obj != layer_type;
	    }); // remove from our array of hidden location types
	}
	
	updateTrafficTableForCheckboxesAndDisplayedLocationTypes(); // because adding/removing a layer changes the checkboxes
    }
}

for(var i=0; i < location_types.length; i++) {
    var type = location_types[i];

    // create new group and add to map
    var lg = L.layerGroup([]);
    lg.addTo(mymap);
    lg.on('add', create_add_remove_function(type, true));
    lg.on('remove', create_add_remove_function(type, false));
    
    layer_groups_by_html["<img src='" + icon_and_file_by_type[type].file + "' width='13'/>&nbsp;" + location_types[i]] = lg;
    layer_groups_by_type[type] = lg;
}


make_map_layer_control(layer_groups_by_html); // set up the control on the map to toggle layers

// here we make places to store location checkbox DOM elements by location type
// so we can display/hide them when the user displays/hides the corresponding marker
// layers on the map.
var checkbox_arrays_by_location_type = {};
for(var i=0; i < location_types.length; i++) {
    checkbox_arrays_by_location_type[location_types[i]] = []; // start with empty arrays
}


var operatorsOnline = new Array(); // array of callsigns
var tacticalCallByCallsign = []; // tactical calls

window.onload = function() {

  // Get references to elements on the page.
  var locationForm = document.getElementById('location-form');
  var locationLatField = document.getElementById('location-form-lat');
  var locationLonField = document.getElementById('location-form-lon');
  var locationTypeField = document.getElementById('location-form-type');
  var locationLabelField = document.getElementById('location-form-label');
  var locationDescField = document.getElementById('location-form-desc');
  var locationRadiusField = document.getElementById('location-form-radius');
  var locationIncidentOnlyCB = document.getElementById('location-form-incident-only-cb');

    var newTrafficForm = document.getElementById('traffic-form');
    var trafficFromField = document.getElementById('traffic-form-from');
    var trafficToField = document.getElementById('traffic-form-to');
    var trafficLocationLabelField = document.getElementById('traffic-form-loc-label');
    var trafficMessageField = document.getElementById('traffic-form-message');
    var trafficPrecedenceSelect = document.getElementById('traffic-form-precedence');
    var trafficFileUpload = document.getElementById('traffic-form-file-button');
    
    var statusForm = document.getElementById('status-form');

    // put the version string in there
    document.getElementById("app-version").innerHTML = VERSION;

    // are we testing?
    if(TEST_MODE) document.getElementById("test-text").innerHTML = "TESTING";
    
    
  // create a new location on server
  locationForm.onsubmit = async function(e) {
    e.preventDefault();

    // Retrieve the data
      var lat = parseFloat(locationLatField.value);
      var lon = parseFloat(locationLonField.value);
      var location_type = locationTypeField.value;
      var label = locationLabelField.value;
      var desc = locationDescField.value;
      var radius_m = parseFloat(locationRadiusField.value);
      var incident_only = locationIncidentOnlyCB.checked;

      if(location_type == "incident") desc = add_test_string_if_needed(desc);
      
      // check to see if the location label is already in use
      if(await getLocationDocForLabel(label) != null) {
	  locationLabelField.select();
	  locationLabelField.focus();
	  
	  alert("Location with label '" + label + "' already exists. Use a different label.");
	  return;
      }
      
      var doc = createLocationDoc(lat, lon, location_type, label, desc, radius_m, incident_only ? currentIncident.contents.label : null);

	try {
	    await localDB.put(doc);
	} catch(err) {
	    console.log(err); 
	    alert(err);
	}

      // clear stuff out so we don't accidentally create the same one twice
    locationLabelField.value = '';
    locationDescField.value = '';

    return false;
  };

    document.getElementById("change-tactical-id").onclick = function(e) {
	e.preventDefault();

	var newCall = prompt("Enter new tactical ID", $('#tactical-call').text());

	if(newCall == null)
	    return false; // canceled
	
	if(newCall == "" || newCall == "null") newCall = null; // blank means remove tactical call. Also check for "null"

	tacticalCall = newCall;
	sessionStorage.setItem(TACTICAL_CALL_ID, newCall); // save in the session
	
	displayTacticalCall();
	
	return false;
    }
    
    document.getElementById('upload-locations-button').onclick = function(e) {
	e.preventDefault();

	// launch the file chooser
	$('#upload-locations-file').trigger('click');
    };

    
    document.getElementById('upload-locations-file').onchange = function(e) {
	e.preventDefault();

	var locationsFileInput = document.getElementById('upload-locations-file');

	if(locationsFileInput.files == null) return; // nothing selected
	
	var filePath = locationsFileInput.files[0];
	var reader = new FileReader();

	// File format is TSV, four columns: label, description, type, latitude, longitude
	reader.onload = async function(e) {
	    var badLabels = []; // for labels already in use
	    var contents = reader.result;
	    
	    var lines = contents.split('\n');

	    for(var i=0; i < lines.length; ++i) {
		if(lines[i].length == 0)
		    continue;
		
		var tokens = lines[i].split('\t');

		var loc_label = tokens[0];
		var desc = tokens[1];
		var type = tokens[2];
		var lat = tokens[3];
		var lon = tokens[4];


		// make sure this location label doesn't already exist
		var found = await localDB.find({
		    selector: {
			'type': 'location',
			'contents.label': loc_label
		    }
		});
		
		if(found.docs.length != 0) {
		    badLabels.push(loc_label);
		    continue; // skip this one because it already exists
		}

		var doc = createLocationDoc(parseFloat(lat), parseFloat(lon), type, loc_label, desc, 0);

		try {
		    await localDB.put(doc);
		} catch(err) {
		    console.log(err);
		    alert(err);
		}

	    }

	    // we had to cut some because duplicates
	    if(badLabels.length != 0) {
		var joined = badLabels.join(' ');

		alert("These location labels already exist in the database and were not created: " + joined);
	    }
	};
	
	reader.readAsText(filePath);

    };
    
    statusForm.onsubmit = async function(e) {
    e.preventDefault();

      // Retrieve the data
	var callsign = $('#callsign-text').val().trim();
	var location = $('#location-text').val().trim();
	var lat = parseFloat($('#status-form-lat').val());
	var lon = parseFloat($('#status-form-lon').val());
	var status = add_test_string_if_needed($('#status-text').val().trim());
      
	var doc = createOperatorStatusDoc(callsign, tacticalCall, location, status, lat, lon);

	try {
	    await localDB.put(doc);
	} catch(err) {
	    console.log(err);
	    alert(err);
	}


    // clear stuff out
    $('#status-text').val('');

    return false;
  };

    sendTraffic = async function(from, from_tactical, to, message, precedence, locLabel, incidentLabel, attachment_id, attachment_name, attachment_size_bytes) {
	var doc = createTrafficDoc(from, from_tactical, to, message, precedence, locLabel, incidentLabel, attachment_id, attachment_name, attachment_size_bytes);
	
	
	try {
	    await localDB.put(doc);
	} catch(err) {
	    alert("Unable to send traffic: " + err);
	    console.log(err);
	}
    }

    newTrafficForm.onsubmit = async function(e) {
	e.preventDefault();

	// Retrieve the data
	var from = trafficFromField.value.trim();
	var to = trafficToField.value.trim();
	var message = add_test_string_if_needed(trafficMessageField.value.trim());
	var precedence = trafficPrecedenceSelect.value;
	var locLabel = trafficLocationLabelField.value.trim();

	// if emergency precedence then get confirmation
	if(precedence=="emergency") {
	    if(!confirm("Really send emergency traffic?"))
		return false;
	}
	
	// if we are relaying, then don't use our tactical call because it's not from us
	var from_tactical = (username==from || tacticalCall==from) ? tacticalCall : null;

	var attachment_id = null; // no attachement

	// do we have a file attached?
	if(trafficFileUpload.files.length != 0) { // something specified2
	    var filePath = trafficFileUpload.files[0];
	    var reader = new FileReader();

	    reader.onload = async function(e) {
		var arrayBuffer = reader.result; // the file data as an ArrayBuffer
		var name = filePath.name; // the file name

		// convert to base64
		var data = btoa(
		    new Uint8Array(arrayBuffer)
			.reduce((data, byte) => data + String.fromCharCode(byte), '')
		);

		var size_bytes = data.length;
		if(size_bytes > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
		    alert("File size is " + (size_bytes/1024/1024) + " MB. Max allowed is " + MAX_ATTACHMENT_SIZE_MB);
		    return;
		}

		var doc = createDoc("attachment", username + "_" + name + "_" + (new Date()).getTime(), "1");
		attachment_id = doc._id;
		doc.contents = {
		    "filename": name,
		    "data": data,
		    "bytes": size_bytes
		};

		try {
		    await attachment_db.put(doc); // save it

		    sendTraffic(from, from_tactical, to, message, precedence, locLabel, currentIncident.contents.label, attachment_id, name, size_bytes);
		} catch (err) {
		    alert("Unable to save attachment: " + err);
		    console.log(err);
		}

	    }


	    // Read in the image file as a data URL.
	    reader.readAsArrayBuffer(filePath);
	} else { // no file attached
	    sendTraffic(from, from_tactical, to, message, precedence, locLabel, currentIncident.contents.label, null, null, null);
	}

	// clear stuff out
	$('#traffic-form-message').val('');
	trafficFileUpload.value = ''; // no attachment

	return false;
    };
};

//
// The main app
//


function timeIsWithinCurrentIncident(time_ms) {
    	return time_ms >= currentIncident.contents.start_time_ms &&
	(currentIncident.contents.end_time_ms == null || time_ms <= currentIncident.contents.end_time_ms);
}

// add a testing string if we are in TEST_MODE
function add_test_string_if_needed(str) {
    if(TEST_MODE)
	return "TESTING: " + str;
    else
	return str;
}

async function updateOnlineOperators() {
    operatorInfo = await getOperatorsOnline(120);

    operatorsOnline = operatorInfo.callsigns;
    tacticalCallByCallsign = operatorInfo.tacticals;
    
    refreshOperatorStatusTable(false);
    $('#operators-online').html("Operators online: <strong>" + operatorsOnline.join(' ') + "</strong>");
}

// Do the incidents overlap in time and space?
async function incidentsOverlap(incident1, incident2) {
    if(incident1.contents.label == incident2.contents.label) // same incident
	return true;
    
    // get the regions
    var r1 = await getRegionDocForLabel(incident1.contents.region_label);
    var r2 = await getRegionDocForLabel(incident2.contents.region_label);

    if(!regionsOverlap(r1, r2)) return false; // regions must have some overlap

    // regions overlap. Do times overlap?
    var c1 = incident1.contents;
    var c2 = incident2.contents;
    return timeRangesOverlap(c1.start_time_ms, c1.end_time_ms,
			     c2.start_time_ms, c2.end_time_ms);
}

// tests to see if a location is relevant to the given incident (meaning their
// times overlap or that the location is not incident-specific)
function locationRelevantToIncident(loc_doc, incident_doc) {
    var incident = loc_doc.contents.incident;
    if(incident===undefined || incident==null)
	return true;

    location_incident_doc = incidentByLabel[loc_doc.contents.incident];

    if(location_incident_doc===undefined || location_incident_doc==null) {
	console.log("Unable to find doc for incident " + incident);
	return true;
    }

    var its_1 = location_incident_doc.contents.start_time_ms;
    var ite_1 = location_incident_doc.contents.end_time_ms;
    var its_2 = incident_doc.contents.start_time_ms;
    var ite_2 = incident_doc.contents.end_time_ms;
    // if neither incident has an end then they overlap
    if(ite_1 == null && ite_2 == null)
	return true;
    
    // if both have end times then one of the end times need to be within the others
    if(ite_1 != null && ite_2 != null) {
	return (ite_1 >= its_2 && ite_1 <= ite_2) || (ite_2 >= its_1 && ite_2 <= ite_1);
    }
    
    // only one or the other has an end time
    return (ite_1==null && ite_2 >= its_1) || (ite_2==null && ite_1 >= its_2);
}

// endTimes can be null, meaning no end point.  The times are numbers
// (e.g. ms since start of epoch)
function timeRangesOverlap(startTime1, endTime1, startTime2, endTime2) {
    if(endTime1==null && endTime2==null) return true;

    if((endTime1==null && endTime2 >= startTime1) ||
       (endTime2==null && endTime1 >= startTime2)) return true;

    if(endTime1 < startTime2 || endTime2 < startTime1) return false;

    return true;
}

// is the given point within the region
function regionsOverlap(region1, region2) {
    if(region1===undefined || region2===undefined || region1==null || region2==null)
	return false; // one or the other not found

    var c1 = region1.contents;
    var c2 = region2.contents;
    
    return Math.abs(c1.lat-c2.lat) <= (c1.lat_span+c2.lat_span)/2 
	&& Math.abs(c1.lon-c2.lon) <= (c1.lon_span+c2.lon_span)/2;
}

function displayTacticalCall() {
    if(tacticalCall != null && tacticalCall != "null") { // is there a value?
	$('#tactical-call').val(tacticalCall);
    } else {
	$('#tactical-call').val("");
    }
}

function doLogout() {
    // clear the saved user info
    sessionStorage.removeItem(USERNAME_ID);
    sessionStorage.removeItem(PASSWORD_ID);
    
    window.location = "index.html"; // go back to login page
}

// handle a new piece of traffic
function handleTraffic(traffic) {
    // somewhere we care about, and in our timeframe?
    var location = traffic.contents.location_label;
    var time_ms = traffic.creation_time_ms;

    // If there is a location specified, then the "all" checkbox or that location's
    // checkbox must be checked.
    // If there is no location specified then either the "all" checkbox or the "unspecified"
    // must be checked.

    if(traffic.contents.precedence != 'emergency' ) { // always display emergency traffic
	if(!document.getElementById('all-locs-checkbox').checked) { // if all not checked then we need to look closely
	    if(location == '' && !document.getElementById('unspecified-loc-checkbox').checked)
		return;  // unspecified location but we are not interested in those
	    
	    if(location != '') { // location was specified. If se find a checkbox then make sure it is checked
		// checkbox for the given location must be checked
		var cb = $("input[type=checkbox][value='" + location + "']");
		if(cb.length != 1)
		    return; // need to find exactly one
		
		if(!cb[0].checked) // must be checked
		    return;
	    }
	}
    }
	
    // within time range?
    if(!timeIsWithinCurrentIncident(time_ms))
	return;

    // ok - we like it. Put it in the traffic table
    var tr = prependToTrafficTable(traffic);
    runTrafficTableTriggers(tr);

    // and if there is an associated location, animate a highlight
    if(traffic.contents.location_label != null) {
	var doc = locationsByLabel[traffic.contents.location_label];

	if(!(doc===undefined) && doc != null)
	    animateHighlightMarkerAt(doc.contents.lat, doc.contents.lon);
    }

}

function highlightOperator(callsign) {
    doc = statusByOperator[callsign];

    if(!(doc===undefined) && doc != null) {
	animateHighlightMarkerAt(doc.contents.lat, doc.contents.lon);
    }
}


function clearTrafficTable() {

    // now make empty table
    var table = document.createElement('TABLE');
    table.setAttribute('id', 'traffic-table');
    table.setAttribute('class', 'tablesorter');
    table.setAttribute('style', 'width: 100%;');
    table.border = '1';

    var tableHead = document.createElement('THEAD');
    tableHead.innerHTML = '<TR><TH>From</TH><TH>To</TH><TH>Time</TH><TH>Rel. time</TH><TH>Location</TH><TH>Prec.</TH><TH>Attachment</TH></TR>';
    table.appendChild(tableHead);

    var tableBody = document.createElement('TBODY');
    tableBody.setAttribute("id", "traffic-table-body"); // so we can find it later
//    tableBody.style.cssText = 'height: 100px; overflow-y: scroll';
    table.appendChild(tableBody);

    $('#traffic-table-div').empty(); // empty it of the table
    var myTableDiv = document.getElementById("traffic-table-div");
    myTableDiv.appendChild(table);

    $("#traffic-table").tablesorter({cssChildRow: "tablesorter-childRow",
				     sortList: [[2, 1]], // sort by time initially
    				     widgets: ['scroller'],
				     widgetOptions : {
//					 scroller_height : 320,
					 // scroll tbody to top after sorting
					 scroller_upAfterSort: true,
					 // pop table header into view while scrolling up the page
					 scroller_jumpToHeader: true
					 }
				    }); // make sortable

}

// put traffic at the top of the table
function prependToTrafficTable(traffic) {
    var tableBody = document.getElementById("traffic-table-body");

    var tr = document.createElement('TR');

    var td;
    var tn;

    // from. If the creator of the message is not the same as from, then it was relayed
    var from = traffic.contents.from.toLowerCase();

    var from_tactical = traffic.contents.from_tactical;
    if(from_tactical === undefined) from_tactical = null;
    if(from_tactical == "null") from_tactical = null; // Sometimes these are ending up as "null". Need to figure out.

    if(from_tactical != null) from_tactical = from_tactical.toLowerCase();

    if(from_tactical == null) {
	var from_str = from;
	var click_to = from;
    } else {
	var from_str = from_tactical + " (" + from + ")";
	var click_to = from_tactical;
    }
    
    var creator = traffic.creator.toLowerCase();
    var is_relay = creator != from;

    td = document.createElement('TD');
    td.setAttribute('rowspan', '2');
    td.style.verticalAlign = 'middle';
    if(from == username.toLowerCase()) td.style.fontWeight = 'bold'; // from us?
    if(!is_relay) {
	tn = document.createTextNode(from_str);
    } else {
	tn = document.createTextNode(from_str + " [rly:" + creator + "]");
    }
    td.appendChild(tn);
    tr.appendChild(td);
    // set a click handler
    td.onclick = function() {
	document.getElementById("traffic-form-to").value = click_to;
	highlightOperator(from); // highlight the operator (not the tactical) if we know where they are
    };

    // to
    var to = traffic.contents.to.toLowerCase();
    td = document.createElement('TD');
    td.setAttribute('rowspan', '2');
    td.style.verticalAlign = 'middle';
    if(to.toLowerCase() == username.toLowerCase()) td.style.fontWeight = 'bold'; // to us?
    tn = document.createTextNode(to);
    td.appendChild(tn);
    tr.appendChild(td);
    // set a click handler
    td.onclick = function() {
	document.getElementById("traffic-form-to").value = to;
	highlightOperator(to); // highlight them if we know where they are
    };

    // time
    var time_info = makeTimeInfo(traffic.creation_time_ms/1000.0);

    td = document.createElement('TD');
    td.appendChild(time_info.time_text);
    tr.appendChild(td);

    td = document.createElement('TD');
    td.appendChild(time_info.time_relative);
    tr.appendChild(td);

    // location
    td = document.createElement('TD');
    if(traffic.contents.location_label == null) {
	td.appendChild(document.createTextNode(''));
    } else {
	td.appendChild(document.createTextNode(traffic.contents.location_label));
    }
    tr.appendChild(td);
    
    // precedence
    var firstChar = traffic.contents.precedence.charAt(0).toUpperCase();
    td = document.createElement('TD');
    td.appendChild(document.createTextNode(firstChar));
    tr.appendChild(td)


    // attachment
    td = document.createElement('TD');
    var attachment_id = traffic.contents.attachment_id;
    if(!(attachment_id === undefined || attachment_id == null)) {
	// has attachment
	var downloadButton = document.createElement('BUTTON');
	downloadButton.setAttribute('type', 'button');
	downloadButton.setAttribute('class', 'attachment-button');
	var buttonText = filesize(parseInt(traffic.contents.attachment_size_bytes));
	downloadButton.appendChild(document.createTextNode(buttonText));
	downloadButton.onclick = async function() {
	    // get the document
	    try {
		var doc = await attachment_db.get(attachment_id);
	    } catch (err) {
		alert("Cannot download attachment: " + err);
		console.log(err);
	    }

	    var bin = convertBase64oBinary(doc.contents.data); // convert from base64
	    var blob = new Blob([bin]);
	    saveAs(blob, doc.contents.filename);
	};

	td.appendChild(downloadButton);
    }
    tr.appendChild(td)

    // message
    bgColor = firstChar == "E" ? "#FFD6D6" : (firstChar == "P" ? "#F9F9E8" : "#F0FFED");
    td = document.createElement('TD');
    td.setAttribute("colspan", "10"); // whole row
    td.style.backgroundColor = bgColor;
    td.style.textAlign = 'left';
    td.appendChild(document.createTextNode(traffic.contents.message));
    var tr_message = document.createElement('TR');
    tr_message.setAttribute('class', 'tablesorter-childRow');
    tr_message.appendChild(td);

    // prepend to table body
    $("#traffic-table-body").prepend(tr_message); // Prepend the message itself
    $("#traffic-table-body").prepend(tr); // Prepend the message info

    return tr;
}

function runTrafficTableTriggers(tr) {
    $("#traffic-table").trigger("update"); // need to inform of this update first before the "addRows" trigger
    $("#traffic-table-body").trigger('addRows', [tr, true]); // tell table sorter
    $('body').timeago('refresh'); // restart all timeagos
}

function makeTimeInfo(timeSec) {
    var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
    d.setUTCSeconds(timeSec); // set the time correctly

    var isoString = d.toISOString(); // get date as ISO standard
    var timeString = moment(isoString).format('YYYY-MM-DD HH:mm');

    var text = document.createTextNode(timeString);

    var time = document.createElement('TIME');
    time.setAttribute("class", "timeago");
    time.setAttribute("datetime", isoString);
    
    return({time_text: text, time_relative:time});
}


// handle a new operator status
function handleOperatorStatus(operator_status) {
    placeMarkerForOperator(operator_status);

    refreshOperatorStatusTable(false); // this will update statusByOperator
    showInfoForSelectedLocation(); // new operator status may impact this
}

// create and draw marker for operator
function placeMarkerForOperator(operator_status) {
    var callsign = operator_status.contents.callsign;

    // remove any old marker
    if(callsign in markerByCallsign) {
	var old_marker = markerByCallsign[callsign];
	old_marker.remove();
    }

    var lat = operator_status.contents.lat;
    var lon = operator_status.contents.lon;
    
    var marker = L.marker([lat, lon], {icon: operator_icon});
    marker.bindPopup("<b>" + operator_status.contents.callsign + "</b> " + operator_status.contents.location_text
		     + "<br>" + operator_status.contents.status_text);
    marker.addTo(mymap);

    markerByCallsign[callsign] = marker; // save it
}

// courtesy of borismus https://gist.github.com/borismus/1032746
function convertBase64oBinary(base64) {
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));

  for(i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function refreshOperatorStatusTable(drawMarkers) {
    // First get all statuses
    getLatestOperatorStatusForCurrentRegion().then(function(statuses) {
	statusByOperator = statuses; // save
	
	$("#operator-status-tbody").empty(); // empty the table
	
	keys = Object.keys(statuses);
	
	if(keys.length == 0) return;
	
	for(var i=0; i < keys.length; i++) {
	    var status = statuses[keys[i]];
	    
	    if(drawMarkers) placeMarkerForOperator(status);
	    
	    var tr = document.createElement('TR');
	    // if row clicked then highlight the location and put username in the "to" field for traffic
	    tr.onclick = (function() { 
		var to = status.contents.callsign;
		
		return function() {
		    document.getElementById("traffic-form-to").value = to; // load into "to" field if clicked
		};
	    })();
	    
	    // make hovering functions which show/erase marker
	    hover_fns = (function() {
		var thisStatus = status;
		var marker = null;
		
		var hover_on_fn = function() {
		    var lat = thisStatus.contents.lat;
		    var lon = thisStatus.contents.lon;
		    
		    marker = showHighlightMarkerAt(lat, lon);
		};
		
		var hover_off_fn = function() {
		    mymap.removeLayer(marker);
		};
		
		return [hover_on_fn, hover_off_fn];
	    })();
	    
	    // when hovering, highlight
	    $(tr).hover(hover_fns[0], hover_fns[1]);
	    
	    
	    var td
	    var tn;
	    
	    // callsign
	    td = document.createElement('TD');
	    var callsign = status.contents.callsign;
	    var tactical = tacticalCallByCallsign[callsign];
	    var text;
	    if(tactical===undefined || tactical==null)
		text = callsign;
	    else
		text = tactical + " (" + callsign + ")"; // if they have a tactical ID then use that first
	    td.appendChild(document.createTextNode(text));
	    tr.appendChild(td);

	    // online
	    td = document.createElement('TD');
	    td.appendChild(document.createTextNode(operatorsOnline.includes(status.contents.callsign) ? "Yes" : "No"));
	    tr.appendChild(td);
	    
	    // time
	    var time_info = makeTimeInfo(status.creation_time_ms/1000.0);
	    
	    td = document.createElement('TD');
	    td.appendChild(time_info.time_text);
	    tr.appendChild(td);
	    
	    td = document.createElement('TD');
	    td.appendChild(time_info.time_relative);
	    tr.appendChild(td);
	    
	    // location
	    td = document.createElement('TD');
	    td.appendChild(document.createTextNode(status.contents.location_text));
	    tr.appendChild(td);
	    
	    // status
	    td = document.createElement('TD');
	    td.appendChild(document.createTextNode(status.contents.status_text));
	    tr.appendChild(td);

	    
	    // prepend to table body
	    var resort = true;
	    $("#operator-status-tbody").prepend(tr); // do the prepend
	    $("#operator-status-table").trigger("update"); // need to inform of this update first before the "addRows" trigger
	    $("#operator-status-tbody").trigger('addRows', [tr, resort]); // tell table sorter
	    
	    $('body').timeago('refresh'); // restart all timeagos
	}
    });
}

// make a nice string to show the operator
function makeOperatorString(callsign, tacticalCall) {
    // use tactical call if available
    if(tacticalCall===undefined) tacticalCall = null;

    if(tacticalCall != null && tacticalCall != '')
	return tacticalCall + " (" + callsign + ")";
    else
	return callsign;
}

// user clicked on the lock status location
function statusLockClicked() {
    // disable location inputs if checkbox is checked
    var disable = $('#status-locked-checkbox').is(':checked');

    $("#location-text").prop('disabled', disable);
    $("#status-form-lat").prop('disabled', disable);
    $("#status-form-lon").prop('disabled', disable);

    return false;
}

function locationLockClicked() {
    // disable location inputs if checkbox is checked
    var disable = $('#locations-locked-checkbox').is(':checked');

	// Get all the location checkboxes
    $('#locations-form [type=checkbox]').each(function() {
	if($(this).val() != "_ignore_") { // ignore the lock
	    $(this).prop('disabled', disable);
	}
    });

    return false;
}


// a location document was added, changed, or deleted
function handleLocation(loc_doc, deleted, updateTrafficTable, highlight) {
    var label = loc_doc.contents.label;
    
    var label_checkbox_id = 'loc-checkbox-' + label;	// name of the checkbox label
    var label_id = 'checkbox-label-' + label;	// name of the checkbox label

    // update our set of known locations and checkbox displays
    if(deleted) {
	delete locationsByLabel[label];
	delete locationsByID[loc_doc._id];
	
	$('#' + label_id).remove(); // remove checkbox
	var location_type = loc_doc.contents.location_type;
	if(location_type===undefined) location_type = 'other'; // just in case
	checkbox_arrays_by_location_type[location_type] = checkbox_arrays_by_location_type[location_type].filter(function(obj) {
	    return obj.id != label_id;
	}); // remove it from the array by filtering
	
	updateTrafficTableForCheckboxesAndDisplayedLocationTypes();

	removeLocationFromMap(label);

	// if they had selected it, then no longer selected
	selectedLocationLabel = null;
	showInfoForSelectedLocation();
    } else { // add new or updated
	// remove anything previous on the map
	removeLocationFromMap(label);
	
	locationsByLabel[label] = loc_doc; // save it
	locationsByID[loc_doc._id] = loc_doc;

	// add new checkbox
	var label_elem = document.createElement("LABEL");
	label_elem.innerHTML ='<input type="checkbox" id="' + label_checkbox_id +
	    '" value="' + label + '" onclick="updateTrafficTableForCheckboxesAndDisplayedLocationTypes()">' +
	    label + "&nbsp;";
	label_elem.setAttribute("id", label_id)
	label_elem.setAttribute("class", "displayed-location-checkbox-label")
	$('#locations-form').append(label_elem);

	// store the DOM so it can be retrieved later by location type
	var location_type = loc_doc.contents.location_type;
	if(location_type === undefined) location_type = 'other'; // just in case
	checkbox_arrays_by_location_type[location_type].push(label_elem); // store it
	
	// add new marker
	addLocationToMap(loc_doc);

	// make hovering functions which show/erase marker
	hover_fns = (function() {
	    var marker = null;

	    var hover_on_fn = function() {
		var lat = loc_doc.contents.lat;
		var lon = loc_doc.contents.lon;

		marker = showHighlightMarkerAt(lat, lon);
	    };

	    var hover_off_fn = function() {
		mymap.removeLayer(marker);
	    };

	    return [hover_on_fn, hover_off_fn];
	})();
	
	// when hovering, highlight
	$(label_elem).hover(hover_fns[0], hover_fns[1]);

    }

    // if user has selected all then update traffic
    if(updateTrafficTable && $('#all-locs-checkbox').is(':checked')) {
	updateTrafficTableForCheckboxesAndDisplayedLocationTypes(); // this should do the trick
    }

    // are we displaying this location? If so, update
    if(selectedLocationLabel == label) {
	// has the user edited with unsaved changes?
	var displayed_info = $('#disp-location-info').val();

	if(displayed_info != lastSelectedLocationDisplayedInfo) {
	    if(timeIsWithinCurrentIncident(loc_doc.contents.info_update_time_ms)) {
		alert("Location info for " + label + " has changed since your unsaved edit. This was your version (copy to clipboard so you don't lose it):\n" + displayed_info);
	    }
	}
	    
	showInfoForLocationDoc(loc_doc);
    }

    if(highlight)
	animateHighlightMarkerAt(loc_doc.contents.lat, loc_doc.contents.lon, highlight);
}

// Change which traffic is displayed basecd on which checkboxes are checked and which layers are displayed
function updateTrafficTableForCheckboxesAndDisplayedLocationTypes() {
    var locationLabelsTrafficDisplayed = new Set();
    
    var show_all_traffic = document.getElementById('all-locs-checkbox').checked;
    var show_unspecified_traffic = document.getElementById('unspecified-loc-checkbox').checked || show_all_traffic;

    // figure out excluded locations from removed layers
    var excludedLocationLabels = [];
    var allLocationEntries = Object.entries(locationsByLabel);
    // figure out whom to exclude
    for(var i=0; i < allLocationEntries.length; i++) {
	var type = allLocationEntries[i][1].contents.location_type;
	if(hidden_location_types.includes(type)) excludedLocationLabels.push(allLocationEntries[i][0]);
    }
    
    // special case if they want all locations - put all locations in the set
    if(show_all_traffic) {
	for(var key in locationsByLabel) {
	    var label = locationsByLabel[key].contents.label;

	    if(!excludedLocationLabels.includes(label))
		locationLabelsTrafficDisplayed.add(locationsByLabel[key].contents.label);
	}

	locationLabelsTrafficDisplayed.add(''); // when no location specified
    } else {
	// add in all the values of checked checkboxes in the form
	$('#locations-form [type=checkbox]:checked').each(function() {
	    var label = $(this).val();

	    if(!excludedLocationLabels.includes(label))
		locationLabelsTrafficDisplayed.add(label);
	});
    }


    // note we always show emergency traffic, regardless of whether location is selected
    
    // build up a query based on what the user wants to see
    var locationsArray = Array.from(locationLabelsTrafficDisplayed); // get array of locations

    var query;
    if(currentIncident.contents.end_time_ms != null) { // have an end time?
	query = { selector: {
	    'type': 'traffic',
	    // location that we are interested in or no location
	    $or: [{'contents.location_label': {$in: locationsArray}}, {'contents.location_label': {$eq: ""}}, {'contents.precedence': 'emergency'}],
	    'creation_time_ms': {$gte: currentIncident.contents.start_time_ms},
	  'creation_time_ms': {$lte: currentIncident.contents.end_time_ms}}
	};
    } else {
	query = {selector: {
	    'type': 'traffic',
	    // location that we are interested in or no location
	    $or: [{'contents.location_label': {$in: locationsArray}}, {'contents.location_label': {$eq: ""}}, {'contents.precedence': 'emergency'}],
	    'creation_time_ms': {$gte: currentIncident.contents.start_time_ms}}
		};
    }

    console.log(query);
	
    localDB.find(query).then(function(result) {
	clearTrafficTable();

	var tr = null;

	for(var i=0; i < result.docs.length; i++) {
	    var traffic = result.docs[i];

	    // if traffic has no location then make sure its incident overlaps ours and that we want to show unspecified
	    if(traffic.contents.location_label=="") {
		if(show_unspecified_traffic) {
		    var incidentDoc = incidentByLabel[traffic.contents.incident_label];
		    
		    if(!(incidentDoc===undefined)) { // if it's undefined then include the traffic, to be inclusive
			// now check if the incidents overlap
			if(!incidentsOverlap(incidentDoc, currentIncident))
			    continue; // if they don't overlaop then ignore the traffic
		    }
		} else {
		    continue; // don't want to see unspecified traffic
		}
	    }

	    tr = prependToTrafficTable(traffic);
	}

	runTrafficTableTriggers(tr); // trigger everything now that all have been added
    }).catch(function(err) {
	console.log(err);
	alert(err);
    });

    return false;
}

async function getAllTrafficForIncident() {
    var locationLabels = new Set();

    for(var key in locationsByLabel) {
	locationLabels.add(locationsByLabel[key].contents.label);
    }
    locationLabels.add(''); // when no location specified

    // if nothing desired then we're done
    if(locationLabels.size == 0)
	return [];
    
    // build up a query based on what the user wants to see
    var locationsArray = Array.from(locationLabels); // get array of locations

    var query;
    if(currentIncident.contents.end_time_ms != null) { // have an end time?
	query = { selector: {
	    'type': 'traffic',
	    'contents.location_label': {$in: locationsArray},
	    'creation_time_ms': {$all: [{$gte: currentIncident.contents.start_time_ms}, {$lte: currentIncident.contents.start_time_ms}]}
	}
		};
    } else {
	query = {selector: {
	    'type': 'traffic',
	    'contents.location_label': {$in: locationsArray},
	    'creation_time_ms': {$gte: currentIncident.contents.start_time_ms}}
		};
    }

    trafficArray = [];

    try {
	var result = await localDB.find(query)

	for(var i=0; i < result.docs.length; i++) {
	    var traffic = result.docs[i];
	    
	    trafficArray.push(traffic);
	}
    } catch(err) {
	console.log(err);
	alert(err);
    }

    return trafficArray;
}

var popup = L.popup();

// map click - send the location to various text boxes
function onMapClick(e) {
    var latlon = e.latlng;

    var lat = latlon.lat.toFixed(5);
    var lon = latlon.lng.toFixed(5);
    
    document.getElementById("location-form-lat").value = lat;
    document.getElementById("location-form-lon").value = lon;



    // only if not locked
    if(!$('#status-locked-checkbox').is(':checked')) {
	document.getElementById("status-form-lat").value = lat;
	document.getElementById("status-form-lon").value = lon;
    }
}

mymap.on('click', onMapClick); // handle mouse clicks on the map

// location object was clicked
function locationClicked(loc_label) {
    // put it in the create traffic text box
    document.getElementById('traffic-form-loc-label').value = loc_label;

    var loc = locationsByLabel[loc_label]; // look up that location and put its lat-lon in the right places

    // put it in the operator status area unless locked
    if(!$('#status-locked-checkbox').is(':checked')) {
	document.getElementById('location-text').value = loc_label;
	if(!(loc === undefined)) {
	    var lat = loc.contents.lat;
	    var lon = loc.contents.lon;
	    document.getElementById('status-form-lat').value = lat;
	    document.getElementById('status-form-lon').value = lon;
	}
    }

    // uncheck all checkboxes for monitoring traffic, except check the one clicked on. Only if not locked.
    if( !$('#locations-locked-checkbox').is(':checked')) {
	$("#locations-form :checkbox").each(function(cb) {
	    $(this).prop('checked', $(this).attr('value') == loc_label);
	});

	console.log("Clicked on location: updating traffic table");
	updateTrafficTableForCheckboxesAndDisplayedLocationTypes();
    }

    // remember last location clicked
    if(selectedLocationLabel != loc_label) {
	selectedLocationLabel = loc_label;
	showInfoForSelectedLocation(); // show info

	if(!(loc === undefined)) {
	    var lat = loc.contents.lat;
	    var lon = loc.contents.lon;
	    animateHighlightMarkerAt(lat, lon);
	}
    }
}

// Display/refresh info for the location which has been selected. We do
// this when a new location has been selected or if new info has been
// received about that location.
function showInfoForSelectedLocation() {
    if(selectedLocationLabel == null) {
	// nothing selected - erase what was there
	clearLocationInfoDisplay();
	return;
    }

    var min_lat = currentRegionBounds[0][0];
    var min_lon = currentRegionBounds[0][1];
    var max_lat = currentRegionBounds[1][0];
    var max_lon = currentRegionBounds[1][1];

    var doc = locationsByLabel[selectedLocationLabel];

    if(doc===undefined || doc==null) {
	alert("Unable to find location doc for " + selectedLocationLabel + ". Please report bug.");
	clearLocationInfoDisplay();
	return;
    }

    showInfoForLocationDoc(doc);
}

function clearLocationInfoDisplay() {
    // fill out the specifics
    $("#disp-location-name").text("");
    $("#disp-location-label").text("");
    $("#disp-location-type").text("");
    
    // display the location info text
    $("#disp-location-info").val("");
    $("#disp-location-info-updater").text("");
    $("#disp-location-info-update-time").empty();
    $("#disp-location-info-update-time-rel").empty();
}

function showInfoForLocationDoc(doc) {
    // fill out the specifics
    $("#disp-location-name").text(doc.contents.desc);
    $("#disp-location-label").text("(" + doc.contents.label + ")");
    var location_type = doc.contents.location_type;
    if(location_type===undefined || location_type==null || location_type==NaN) location_type = '';
    $("#disp-location-type").text(location_type);
    
    // display the location info text
    $("#disp-location-info").val("");
    $("#disp-location-info-updater").text("");
    $("#disp-location-info-update-time").empty();
    $("#disp-location-info-update-time-rel").empty();

    if(!(doc.contents.info===undefined) && doc.contents.info != null) {
	// make sure the time of this update is within the incident time
	if(timeIsWithinCurrentIncident(doc.contents.info_update_time_ms)) {
	    lastSelectedLocationDisplayedInfo = doc.contents.info;
	    $("#disp-location-info").val(lastSelectedLocationDisplayedInfo);
	    $("#disp-location-info-updater").text(doc.contents.info_updater);
	    
	    var secondsEpoch = doc.contents.info_update_time_ms/1000;
	    var timeInfo = makeTimeInfo(secondsEpoch);
	    $("#disp-location-info-update-time").append(timeInfo.time_text);
	    $("#disp-location-info-update-time-rel").append(timeInfo.time_relative);
	}
    }

    // display the current time
    var secondsEpoch = (new Date).getTime()/1000;
    var timeInfo = makeTimeInfo(secondsEpoch);

    $("#disp-location-update-time-rel").empty();
    $("#disp-location-update-time-rel").append(timeInfo.time_relative); // timeago

    $('body').timeago('refresh'); // restart all timeagos
    
    // query for everyone at that location and display list of operators
    var dlo_node = $("#disp-location-operators");
    dlo_node.empty(); // remove everything

    // get all the latest statuses and see which match the location
    getLatestOperatorStatusForCurrentRegion().then(function(statuses) {
	var matches = [];
	var docs = Object.values(statuses);
	for(var i=0; i < docs.length; i++) {
	    if(docs[i].contents.location_text == selectedLocationLabel)
		matches.push(docs[i]);
	}

	var str = "";
	
	for(var i=0; i < matches.length; i++) {
	    doc = matches[i];

	    var op_str = makeOperatorString(doc.contents.callsign, doc.contents.tactical_call);

	    if(i != 0) str += ",&nbsp;";

	    str += op_str;
	}

	dlo_node.append(str);
    });

    $('body').timeago('refresh'); // restart all timeagos
}

function submitLocationInfo(e) {
    if(selectedLocationLabel == null) {
	alert("Can't submit new info on unknown location. Please report bug.");
	return;
    }
    
    // get the current document for the location
    var orig_doc = locationsByLabel[selectedLocationLabel];
    if(orig_doc===undefined || orig_doc==null) {
	alert("Unable to find document for location " + selectedLocationLabel + ". Please report bug.");
	return;
    }


    var doc = Object.assign({}, orig_doc); // make a clone so we don't mess up the original in case of error
    doc.contents.info = $('#disp-location-info').val().trim();
    lastSelectedLocationDisplayedInfo = doc.contents.info; // update the last thing we saw
    doc.contents.info_updater = username.toLowerCase();
    doc.contents.info_update_time_ms = (new Date()).getTime();

    try {
	localDB.put(doc); // update the doc in the database. We will get the update and change the local copy in the array.
    } catch(err) {
	console.log(err);
	
	alert(err + ". This was your text:\n\n" + document.getElementById("disp-location-info").val());

    }
}

function displayCurrentIncidentInfo() {
    $('#incident-name').html("Incident: " + currentIncident.contents.label);
    $('#incident-description').val(currentIncident.contents.desc);
    $('#incident-region').val("Region: " + currentIncident.contents.region_label);

    // set up date time fields
    $('#incident-start').datetimepicker();
    $('#incident-end').datetimepicker();

    var start_ms = currentIncident.contents.start_time_ms;
    var end_ms = currentIncident.contents.end_time_ms; // may be null

    var format = 'MM/DD/YYYY HH:mm';
    $('#incident-start').val(moment(start_ms).format(format));
    if(end_ms != null) {
	$('#incident-end').val(moment(end_ms).format(format));
    } else {
	$('#incident-end').val("");
    }
    
    $('#incident-info').empty();
    $('#incident-info-updater').empty();
    $("#incident-info-update-time").empty();
    $("#incident-info-update-time-rel").empty();

    var contents = currentIncident.contents;
    
    if(!(contents.info === undefined)) {
	$('#incident-info').val(contents.info);
	$('#incident-info-updater').append(contents.info_updater);

	var secondsEpoch = contents.info_update_time_ms/1000;
	var timeInfo = makeTimeInfo(secondsEpoch);
	$("#incident-info-update-time").append(timeInfo.time_text);
	$("#incident-info-update-time-rel").append(timeInfo.time_relative);
    }

    // display the current time
    var secondsEpoch = (new Date).getTime()/1000;
    var timeInfo = makeTimeInfo(secondsEpoch);

    $("#incident-update-time-rel").empty();
    $("#incident-update-time-rel").append(timeInfo.time_relative); // timeago

    $('body').timeago('refresh'); // restart all timeagos
}

function submitIncidentInfo(e) {
    var format = "MM/DD/YYYY HH:mm";
    
    // validate that start time is same or earlier than existing
    var start_time_text = $('#incident-start').val();
    var start_time_ms = moment(start_time_text, format, true).unix()*1000;
    if(start_time_ms > currentIncident.contents.start_time_ms) {
	alert("New incident start time must be earlier than existing time.");

	document.getElementById('incident-start').focus();
	
	return;
    }
    
    // validate that end time is same as or later than existing (may be "")
    var end_time_text = $('#incident-end').val();
    if(end_time_text != "" ) {
	var end_time_ms = moment(end_time_text, format, true).unix()*1000;

	if (currentIncident.contents.end_time_ms != null) { // they have updated the time
	    if(end_time_ms < currentIncident.contents.end_time_ms) {
		alert("New incident end time must be later than existing time. new: " + end_time_ms + " old: " + currentIncident.contents.end_time_ms );
		
		document.getElementById('incident-end').focus();
		
		return;
	    }
	}
    } else {
	var end_time_ms = null;
	
	// text is empty. Make sure original was too
	if(currentIncident.contents.end_time_ms != null) {
	    alert("Defined incident end time cannot be removed.");
	    
	    document.getElementById('incident-end').focus();
	    
	    return;
	}
    }

    doc = Object.assign({}, currentIncident); // make a copy so we don't mess up the original

    doc.contents.desc = $('#incident-description').val();
    doc.contents.start_time_ms = start_time_ms;
    doc.contents.end_time_ms = end_time_ms;
    doc.contents.info = $('#incident-info').val().trim();
    doc.contents.info_updater = username.toLowerCase();
    doc.contents.info_update_time_ms = (new Date()).getTime();
    // NB: there is currently no way to change the region.

    var info_changed = doc.contents.info != currentIncident.contents.info; // did they change the info?
    
    try {
	localDB.put(doc); // update the doc. We will get a "changed" event and update our own copy
    } catch(err) {
	console.log(err);

	var err_msg = info_changed ? err + ". This was your text:\n\n" + doc.contents.info : err;
	alert(err_msg);
    }
}

function addLocationToMap(locDoc) {
    var desc = locDoc.contents.desc + " (" + locDoc.contents.label + ")";
    var marker_opts = {title: desc};
    var location_label = locDoc.contents.label;

    // figure out the icon
    var type = locDoc.contents.location_type;
    if(type === undefined) type = 'other'; // just in case
    if(!location_types.includes(type)) type = 'other'; // just in case
    marker_opts.icon = icon_and_file_by_type[type].icon;
    
    var marker = L.marker([locDoc.contents.lat, locDoc.contents.lon], marker_opts);

    marker.on('click', function() { locationClicked(location_label); }); // handle clicking on marker

    // get the group
    var layer_group = layer_groups_by_type[type];
    marker.addTo(layer_group); // and add to it

    markerByLocationLabel[location_label] = marker;

    if(locDoc.contents.radius_m != 0)
	circleByLocationLabel[location_label] =
	    L.circle([locDoc.contents.lat, locDoc.contents.lon],locDoc.contents.radius_m).addTo(mymap);
}

function removeLocationFromMap(label) {
    // remove the marker
    var marker = markerByLocationLabel[label];

    if(!(marker===undefined)) {
	marker.remove();
	delete markerByLocationLabel[label];
    }

    // remove any circle
    var circle = circleByLocationLabel[label];

    if(!(circle===undefined)) {
	circle.remove();
	delete circleByLocationLabel[label];
    }
}

function isWithinCurrentRegion(lat, lon) {
    var min_lat = currentRegionBounds[0][0];
    var min_lon = currentRegionBounds[0][1];
    var max_lat = currentRegionBounds[1][0];
    var max_lon = currentRegionBounds[1][1];

    return lat >= min_lat && lat <= max_lat && lon >= min_lon && lon <= max_lon;
}

////
//// START OF MAIN APP
////


function main_app() {
    document.body.style.cursor = "default"; // default cursor

    // load all incidents
    localDB.find({
	selector: {
	    type: 'incident',
	    "contents.label": {$ne: null}
	}
    }).then(function (result) {
	currentIncident = null;

	if(result.docs.length == 0) 
	    throw 'Unable to find incidents in database';

	for(var i=0; i < result.docs.length; i++) {
	    var doc = result.docs[i];
	    
	    incidentByLabel[doc.contents.label] = doc;
	}

	currentIncident = incidentByLabel[currentIncidentName];

	if(currentIncident===undefined)
	    throw 'Unable to find incident in database: ' + currentIncidentName;

	console.log('Current incident: ' + currentIncident);

	displayCurrentIncidentInfo();
	
	return(localDB.find({
	    selector: {
		type: 'region',
		id: currentIncident.contents.region_label
	    }
	}));
    }).then(function (result) {
	currentRegion = null;
	
	if(result.docs.length == 0) {
	    throw 'Unable to find incident in database: ' + currentIncidentName;
	} else if(result.docs.length > 1) {
	    throw 'Found multiple incidents in database: ' + currentIncidentName;
	}

	currentRegion = result.docs[0];
	console.log('Current region: ' + currentRegion);
	
	return(currentRegion);
    }).then(function(region) { // set up the map area
	currentRegionBounds = getBoundsForRegion(region);
	mymap.fitBounds(currentRegionBounds); // set up map region

	// draw polygon for the region
	L.rectangle(currentRegionBounds, {color: 'red', fill: false}).addTo(mymap);


	var min_lat = currentRegionBounds[0][0];
	var min_lon = currentRegionBounds[0][1];
	var max_lat = currentRegionBounds[1][0];
	var max_lon = currentRegionBounds[1][1];

	// first get all relevant locations
	localDB.find({
	    selector: {
		type: 'location',
		'contents.lat': {$gte: min_lat},
		'contents.lat': {$lte: max_lat},
		'contents.lon': {$gte: min_lon},
		'contents.lon': {$lte: max_lon}
	    }
	}).then(function(result) {
	    // alphabetical ordering
	    result.docs.sort(function(a, b) { return a.contents.label.localeCompare(b.contents.label); });
	    
	    for(var i=0; i < result.docs.length; i++) {
		var loc = result.docs[i];

		// TODO: for some reason the lat/lon filter is not working, so replicate it here
		if(loc.contents.lat < min_lat || loc.contents.lat > max_lat ||
		   loc.contents.lon < min_lon || loc.contents.lon > max_lon)
		    continue; // filter out of not in our region


		if(!locationRelevantToIncident(loc, currentIncident)) // if it is incident-specific and doesn't overlap, then skip
		    continue;
		
		locationsByLabel[loc.contents.label] = loc;
		handleLocation(loc, false, false, false);
	    }

	    updateTrafficTableForCheckboxesAndDisplayedLocationTypes(); // set up the traffic
	});

	$('#callsign-text').val(username); // start with username as callsign, but they can still edit
	$('#traffic-form-from').val(username); // start with username as "from" for traffic
	
	// now add all operator status
	$("#operator-status-table").tablesorter(); // make sortable
	refreshOperatorStatusTable(true);

	// add some info at the top
//	$('#incident-field').text("TEST INCIDENT: " + currentIncident.contents.label);
	$('#incident-field').text(currentIncident.contents.label);
	$('#incident-desc-field').text(currentIncident.contents.desc);

	displayTacticalCall();

	$('#user-field').text("User: " + username);

	// log out button action
	$('#logout-button').click(function() {
	    if(confirm("Log out?")) {
		doLogout();
	    }
	});

	// make sure the file api is available
	if (!(window.File && window.FileReader && window.Blob)) {
	    alert("Attaching files not available in this browser.");
	    console.log('The File APIs are not fully supported in this browser, so you will not be able to upload files.');
	    $("#traffic-form-file-button").prop('disabled', true);
	}

	// set up one user ping per minute
	updatePingDocForUser(username, tacticalCall); // ping immediately
	setInterval(() => updatePingDocForUser(username, tacticalCall), 60000); // and every minute

	// set up polling for operators online
	setTimeout(() => updateOnlineOperators(), 5000); // wait 5 secs for things to get set up before calling
	setInterval(() => updateOnlineOperators(), 20000); // every 20 sec
	
	// register to listen for changes
	console.log("Starting to listen for live changes");
	
	localDB.changes({
	    since: 'now',
	    live: true,
	    include_docs: true
	}).on('change', function (change) {
	    var doc = change.doc;
	    
	    switch(doc.type) {
	    case 'traffic':
		// if the traffic relates to a location that we do not have in our region, then ignore
		var loc_label = change.doc.contents.location_label;
		if(loc_label != null && loc_label != "") {
		    if(!(loc_label in locationsByLabel))
			break; // we don't know about this location so must be outside our region
		}
		
		handleTraffic(change.doc);
		break;

	    case 'location':
		// ignore if outside our region
		if(isWithinCurrentRegion(change.doc.contents.lat, change.doc.contents.lon) &&
		   locationRelevantToIncident(change.doc, currentIncident)) {
		    handleLocation(change.doc, false, true, true);
		}
		break;

	    case 'operator_status':
		handleOperatorStatus(change.doc);
		break;

	    case 'incident':
		if(doc._deleted) {
		    if(doc.contents.label == currentIncidentName) { // oh oh - they deleted our incident! Put it back.
			try {
			    localDB.put(currentIncident);
			} catch(err) {
			    console.log(err);
			    alert(err);
			}
		    } else {
			delete incidentByLabel[doc.contents.label];
		    }
		} else { // changed or new
		    incidentByLabel[doc.contents.label] = doc; // update it. todo: if our incident then we may need to update things

		    if(doc.contents.label == currentIncidentName) { // is this our incident? If so, then update our local copy and display
			currentIncident = doc;
			displayCurrentIncidentInfo();
			refreshOperatorStatusTable(true);
			updateTrafficTableForCheckboxesAndDisplayedLocationTypes(); // since our incident range may have changed its timing

		    }
		}
		break;

	    default:
		if(doc._deleted) {
		    // is it a location?
		    loc_doc = locationsByID[doc._id];
		    if(!(loc_doc===undefined)) {
		    	handleLocation(loc_doc, true, true, true);
		    }
		}
	    }}).on('error', function (err) {
		console.log(err);
		alert(err);
	    });
    }).catch(function (err) {
	console.log(err);
	alert(err);
    });


}

// before running stuff that expects the db to be populated, wait for sync
db_sync_complete = true;
if(db_sync_complete) {
    console.log("db sync already complete");
    main_app();
} else {
    console.log("awaiting db sync");
    sync_complete_callback = main_app;
}

// Get the element with id="defaultOpen" and click on it to set it as an open tab 
document.getElementById("defaultOpen").click(); 


