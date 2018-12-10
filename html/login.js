//
// Copyright 2018 Dan Ruderman (dlruderman2gmail.com)
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

// fill in the credentials request
document.getElementById("credentials-request").innerHTML = '<a href="mailto:' + ADMIN_EMAIL + '"><font size="4">Request credentials</font></a>';

async function credentialsValid(username, password, dbhost, dbport) {
    try {
	var remoteDB = new PouchDB('http://' + username + ':' + password + '@' + dbhost + ':' + dbport + '/' + REMOTE_DB_NAME);
	var info = await remoteDB.info();

	return true;
    } catch(err) {
	return false;
    }

    return false; // shouldn't get here but just in case...
}

// Below function Executes on click of login button.
async function validate_password(){
    var username = document.getElementById("username").value;
    var password = document.getElementById("password").value;
    var dbhost = document.getElementById("database_host").value;
    var dbport = document.getElementById("database_port").value;
    var mapServerURL = document.getElementById('map_server_url').value;
    var run_locally = document.getElementById('local-radio').checked;

    if(username == "") {
	alert("Username must not be blank.");
	return;
    }
    
    if(run_locally) { // the want to run locally
	sessionStorage.setItem(USERNAME_ID, username);
	sessionStorage.setItem(PASSWORD_ID, password);
	sessionStorage.removeItem(DB_HOST_ID);
	sessionStorage.removeItem(DB_PORT_ID, dbport);
	sessionStorage.setItem(MAP_SERVER_ID, mapServerURL);
	sessionStorage.setItem(RUN_TYPE_ID, RUN_TYPE_STANDALONE);

	window.location = "incident.html"; // Redirecting to next page.
	
	return false;
    }
    
    if(await credentialsValid(username, password, dbhost, dbport)) { // connect to remote database
	sessionStorage.setItem(USERNAME_ID, username);
	sessionStorage.setItem(PASSWORD_ID, password);
	sessionStorage.setItem(DB_HOST_ID, dbhost);
	sessionStorage.setItem(DB_PORT_ID, dbport);
	sessionStorage.setItem(MAP_SERVER_ID, mapServerURL);
	sessionStorage.setItem(RUN_TYPE_ID, RUN_TYPE_REMOTE);

	window.location = "db_loading.html"; // Redirecting to other page.
	
	return false;
    } else {
	alert("Login incorrect. Make sure you can reach database host.");
    }
}

$('#username').focus(); // put focus on username field


