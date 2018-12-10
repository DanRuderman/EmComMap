//
// Copyright 2018 Dan Ruderman (dlruderman@gmail.com)
//
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

// requires pouchdb-7.0.0.min.js (or later)

console.log('Loading db.js *')

var username = sessionStorage.getItem(USERNAME_ID);
var password = sessionStorage.getItem(PASSWORD_ID);
var dbhost = sessionStorage.getItem(DB_HOST_ID);
var dbport = sessionStorage.getItem(DB_PORT_ID);
var run_type = sessionStorage.getItem(RUN_TYPE_ID); // RUN_TYPE_STANDALONE or RUN_TYPE_REMOTE

// if we got here without a username, then go to the login page
if(username == null) window.location.href = "index.html";

// connect to local database. Name depends on whether we are running locally only or syncing with remote db
var local_db_name = run_type==RUN_TYPE_STANDALONE ? RUN_LOCAL_LOCAL_DB_NAME : LOCAL_DB_NAME;
var localDB = new PouchDB(local_db_name);


if(run_type == RUN_TYPE_REMOTE) {
    // remote DBs
    var base_remote_url = 'http://' + username + ':' + password + '@' + dbhost + ':' + dbport;
    var remote_db_url = base_remote_url + "/" + REMOTE_DB_NAME; // master database that we replicate
    console.log("Remote DB url: " + remote_db_url);
    var attachment_db_url = base_remote_url + "/" + ATTACHMENT_DB_NAME;
    
    // TODO - test this connection and report any errors
    var attachment_db = new PouchDB(attachment_db_url); // connect to db that stores file attachments


    // sync main databases
    var sync_complete_callback = null;
    var db_sync_complete = false;
    var opts_initial_sync = { live: false, retry: true }; // we want to sync and complete, auto retry
    var opts_live_sync = { live: true, retry: true }; // we want live replication and auto retry

    localDB.sync(remote_db_url, opts_initial_sync)
	.on('error', function(info) { alert("Unable to sync to master database. Try reloading the web page."); })
	.on('change', function(info) {
	    console.log("Got a change during initial sync.");
	})
	.on('complete', function() {
	    console.log("Initial db sync complete");
	    localDB.sync(remote_db_url, opts_live_sync) // now do a live sync
		.on('error', function(info) { alert("Unable to sync to master database. Please report this error to DLRuderman@gmail.com ."); })
		.on('active', function(info) {  })
		.on('paused', function(info) {  });
	    console.log("Live sync initiated");
	    db_sync_complete = true;
	    if(sync_complete_callback != null ) {
		var tmp_callback = sync_complete_callback;
		sync_complete_callback = null; // null it out ASAP so it is not called more than once
		setTimeout(tmp_callback, 0); // callback
	    }
	});
    console.log('sync initiated');
} else {
    var attachment_db = new PouchDB(ATTACHMENT_DB_NAME); // connect to local attachment database in browser
    db_sync_complete = true; // don't need to sync, so just proceed
}

// Create indexes if needed
localDB.createIndex({
  index: {
      fields: ['type', 'id']
  }
}).then(function (result) {
    console.log('Index creation: ' + result);
}).catch(function (err) {
  console.log(err);
});

localDB.createIndex({
  index: {
      fields: ['type']
  }
}).then(function (result) {
    console.log('Index creation: ' + result);
}).catch(function (err) {
  console.log(err);
});

localDB.createIndex({
  index: {
      fields: ['type', 'contents.lat', 'contents.lon']
  }
}).then(function (result) {
    console.log('Index creation: ' + result);
}).catch(function (err) {
  console.log(err);
});


localDB.createIndex({
  index: {
      fields: ['type', 'contents.from', 'contents.to', 'creation_time_ms']
  }
}).then(function (result) {
    console.log('Index creation: ' + result);
}).catch(function (err) {
  console.log(err);
});

function getUniqueID() {
    // has user name current time in ms and then a 3-digit random integer for good measure
    return(username + '_' + (new Date()).getTime() + '_' + Math.floor(Math.random() * 1000));
}


// create basic document. The pair (type, id) should be unique
function createDoc(type, id, version) {
    return(
	{
	    "_id": getUniqueID(),
	    "creation_time_ms": (new Date()).getTime(), // UTC epoch in milliseconds
	    "creator": username.toLowerCase(),
	    "type": type,
	    "id": id,
	    "version": version,
	    "contents": {}
	})
}

// here incident is either the label of an incident or null if thie location outlives
// any specific incident
function createLocationDoc(lat, lon, location_type, label, desc, radius_m, incident) {
    var doc = createDoc("location", label, "1");

    doc.contents = {
	"lat": lat,
	"lon": lon,
	"location_type": location_type,
	"label": label,
	"desc": desc,
	"radius_m": radius_m,
	"incident": incident, // null if not specific to an incident
	"info": null, // start with empty info
	"info_updater": null, // no updater
	"info_update_time_ms": null
    };

    return(doc);
}

function createRegionDoc(center_lat, center_lon, lat_span, lon_span, label, desc) {
    var doc = createDoc("region", label, "1");

    doc.contents = {
	"lat": center_lat,
	"lon": center_lon,
	"lat_span": lat_span,
	"lon_span": lon_span,
	"label": label,
	"desc": desc
    };

    return(doc);
}

// end_time_ms is null if ongoing.
function createIncidentDoc( label, desc, start_time_ms, end_time_ms, region_label) {
    var doc = createDoc("incident", label, "1");
    
    
    doc.contents = {
	"start_time_ms": start_time_ms,
	"end_time_ms": end_time_ms,
	"region_label": region_label,
	"label": label,
	"desc": desc
    };
    
    return(doc);
}

// location_label can be null to not be associated with any particular location
function createTrafficDoc(from, from_tactical, to, message, precedence, location_label, incident_label, attachment_id, attachment_name, attachment_size_bytes) {
    var doc = createDoc("traffic", username + '_' + (new Date()).getTime(), "1");
    
    
    doc.contents = {
	"from": from,
	"from_tactical": from_tactical,
	"to": to,
	"message": message,
	"precedence": precedence,
	"location_label": location_label,
	"incident_label": incident_label,
	"attachment_id": attachment_id,
	"attachment_name": attachment_name,
	"attachment_size_bytes": attachment_size_bytes
    };
    
    return doc;
}


function createOperatorStatusDoc(callsign, tacticalCall, location_text, status_text, lat, lon) {
    callsign = callsign.toLowerCase(); // callsigns in lower case
    
    var doc = createDoc("operator_status", callsign, "1");
    
    
    doc.contents = {
	"callsign": callsign,
	"tactical_call": tacticalCall, // null means none
	"location_text": location_text, // this can either be the label of a location or any text
	// todo: make separate fields for location label and location description to distinguish them
	"status_text": status_text,
	"lat": lat,
	"lon": lon
    };
    
    return(doc);
}

// This is a document that gets updated once a minute by the operator when online
// Tactical call can be null
function createOperatorPingDoc(callsign, tactical_call) {
    var doc = createDoc("operator_ping", callsign, "1");
    
    doc.contents = {
	"callsign": callsign,
	"tactical_call": tactical_call,
	"timestamp_ms": (new Date()).getTime() // UTC epoch in milliseconds
    };
    
    return(doc);
}

// tactical call can be null if unassigned
function updatePingDocForUser(callsign, tactical_call) {
    try {
	localDB.find({ selector: {
	    "type": "operator_ping",
	    "contents.callsign": callsign
	}}).then(function(results) {
	    var doc;
	    
	    if(results.docs.length == 0) { // not found - create
		doc = createOperatorPingDoc(callsign, tactical_call);
	    } else { // found - need to update
		doc = results.docs[0];

		doc.contents.tactical_call = tactical_call;
		doc.contents.timestamp_ms = (new Date()).getTime(); // UTC epoch in milliseconds
	    }

	    localDB.put(doc); // save it
	});
    } catch(err) {
	console.log(err);
	alert(err);
    }
    
}

// Returns null if none. If there are multiple docs, just return the first.
async function getIncidentDocForLabel(label) {
    var query = { selector: {
	'type': 'incident',
	'contents.label': label
    }};
    try {
	var result = await localDB.find(query);
	
	if(result.docs.length == 0) return null;
	
	return result.docs[0];
    } catch(err) {
	console.log(err); // todo - show error to user
	return null;
    }
}

// Returns null if none. If there are multiple docs, just return the first.
async function getLocationDocForLabel(label) {
    var query = { selector: {
	'type': 'location',
	'contents.label': label
    }};
    try {
	var result = await localDB.find(query);
	
	if(result.docs.length == 0) return null;
	
	return result.docs[0];
    } catch(err) {
	console.log(err); // todo - show error to user
	return null;
    }
}

// Returns null if none. If there are multiple docs, just return the first.
async function getRegionDocForLabel(label) {
      var query = { selector: {
	  'type': 'region',
	  'contents.label': label
      }};
      try {
	  var result = await localDB.find(query);

	  if(result.docs.length == 0) return null;

	  return result.docs[0];
      } catch(err) {
	  console.log(err); // todo - show error to user
	  return null;
      }
}

// get an object that has (1) an array of callsigns for operators that have provided a ping
// within the last max_delay_sec seconds and (2) an associative array of tactical calls by callsign.
async function getOperatorsOnline(max_delay_sec) {
    min_time_epoch_ms = (new Date()).getTime() - max_delay_sec*1000; // ping must be after this

    try {
	query = {selector: {
	    "type": "operator_ping",
	    "contents.timestamp_ms": {'$gte': min_time_epoch_ms}
	}};
	
	var results = await localDB.find(query);
	
	var callsigns = new Array();
	var tacticalCalls = new Array()
	
	for(var i=0; i < results.docs.length; i++) {
	    contents = results.docs[i].contents;
	    callsigns.push(contents.callsign);

	    if(contents.tactical_call != null)
		tacticalCalls[contents.callsign] = contents.tactical_call; // keep track of tactical call
	}

	var result = { 'callsigns': callsigns,
		       'tacticals': tacticalCalls };

	
	return result;
    } catch(err) {
	console.log(err);
	alert(err);
    }
}

// Get the latest operator status for the current region. For
// an operator to be included, their latest status must be located
// Within the incident (based on lat/lon). Returns an associative array
// with callsign as the key.
function getLatestOperatorStatusForCurrentRegion() {
    var contents = currentRegion.contents;
    var lat = contents.lat;
    var lon = contents.lon;
    var lat_span = contents.lat_span;
    var lon_span = contents.lon_span;

    var min_lat = lat - lat_span/2;
    var max_lat = lat + lat_span/2;
    var min_lon = lon - lon_span/2;
    var max_lon = lon + lon_span/2;

    var min_time_ms = currentIncident.contents.start_time_ms;
    var max_time_ms = currentIncident.contents.end_time_ms == null ? 1e20 :  currentIncident.contents.end_time_ms;
    
    result = localDB.find({
	selector: {
	    '$and': [
		{type: {'$regex': "operator_status"}},  // testing for equality fails for some reason, so use regex
		{'contents.lat': {'$gte': min_lat}},
		{'contents.lat': {'$lte': max_lat}},
		{'contents.lon': {'$gte': min_lon}},
		{'contents.lon': {'$lte': max_lon}},
		{creation_time_ms: {'$gte': min_time_ms}},
		{creation_time_ms: {'$lte': max_time_ms}}
		]
	}}).then(function(results) {
	    var latestByCallsign = {};
    
	    results.docs.forEach(function(item){
		var callsign = item.contents.callsign;
		var latest = latestByCallsign[callsign];
		
		if(latest) {	    // already have one. see if we are newer
		    if(item.creation_time_ms > latest.creation_time_ms) { // this is newer. Replace the older one
			latestByCallsign[callsign] = item;
		    } 
		} else{
		    latestByCallsign[callsign] = item; // first time - just put it in
		}
	    })

	    return(latestByCallsign);
	});

    return result;
}

function make_map_layer_control(overlayMaps) {
    L.control.layers(null, overlayMaps).addTo(mymap); // null in first argument means no base map control
}


// Keep these around for reference
//la_region = createRegionDoc(34.05487, -118.2449, 0.44769, 0.5456, "LA", "Los Angeles");
//hollywood_incident = createIncidentDoc('20180726_Hollywood', '20180726 Hollywood', 1532632735363, null, 'LA');
