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

console.log("Loading log_to_excel.js")

var Promise = XlsxPopulate.Promise;

async function generate() {
    var traffic = await getAllTrafficForIncident(); // array of traffic

    if(traffic.length == 0) {
	alert("No traffic for incident.");
	return;
    }
    
    // create a 2D array of all traffic data
    var allTraffic = [];
    
    for(var i=0; i < traffic.length; i++) {
	var msg = traffic[i];
	
	var isRelay = msg.creator != msg.contents.from; // must be a relayed message
	var dateObj = new Date(msg.creation_time_ms);
	var m = moment(dateObj);
	
	var dateStr = m.format("YYYY-MM-DD");
	var timeStr = m.format("HH:mm");
	
	var from = msg.contents.from;
	var fromTactical = msg.contents.from_tactical;
	if(fromTactical === undefined || fromTactical == null) fromTactical = "";
	var to = msg.contents.to;
	var relay = isRelay ? msg.creator : "";
	
	var precedence = msg.contents.precedence;
	var message = msg.contents.message;

	var has_attachment = (msg.contents.attachment_id===undefined || msg.contents.attachment_id==null) ? "No" : "Yes";
	var message_id = msg._id;
	
	var msgInfo = [dateStr, timeStr, from, fromTactical, to, relay, precedence, message, has_attachment, message_id];
	
	allTraffic.push(msgInfo);
    }
    
    var workbook = await XlsxPopulate.fromBlankAsync();
    var sheet = workbook.sheet(0);
    sheet.cell("A1").value([["Date", "Time", "From callsign", "From tactical", "To", "Relay", "Precedence", "Message", "Attachment", "Message ID"]]);
    sheet.cell("A2").value(allTraffic).style("horizontalAlignment", "center");
    sheet.column("A").width(10);
    sheet.column("B").width(6);
    sheet.column("C").width(12);
    sheet.column("D").width(14);
    sheet.column("E").width(10);
    sheet.column("F").width(8);
    sheet.column("G").width(10);
    sheet.column("H").width(40).style("wrapText", true).style("horizontalAlignment", "left");
    sheet.column("I").width(12);
    sheet.column("J").width(30);
    sheet.row(1).style("bold", true).style("horizontalAlignment", "center");

    return workbook.outputAsync();
}

async function generateExcelLog(filename) {
    try {
	var blob = await generate();

        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blob, filename);
        } else {
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement("a");
            document.body.appendChild(a);
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    } catch(err) {
        alert(err.message || err);
    }
}

