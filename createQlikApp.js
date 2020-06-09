const enigma = require('enigma.js');
const WebSocket = require('ws');
const path = require('path');
const https = require('https');
const fs = require('fs');
const schema = require('enigma.js/schemas/12.20.0.json');
const { exec } = require("child_process");

const nodeExec = "/usr/bin/node";
const createApp  = "/usr/local/qdc/qlikpublish/createQlikApp.post.js"

const libConnString = "LIB CONNECT TO [";
//const personalLibConnName = "VINCE_PERSONAL";
const logFile = "/tmp/myLogFile.txt";
const SourceConnection = "/usr/local/qdc/qlikpublish/SourceConnection.json"

var appname=process.argv[2];
var LOAD_SCRIPT = process.argv[3];
const userId = process.argv[4];
const engineHost = process.argv[5];
const enginePort = process.argv[6];
const proxyPort = process.argv[7];
const userDirectory = process.argv[8];//'EC'


fs.writeFileSync(logFile, "appname :"+appname);
fs.writeFileSync(logFile, "LOAD_SCRIPT :"+LOAD_SCRIPT);
fs.writeFileSync(logFile, "userId :"+userId);
fs.writeFileSync(logFile, "engineHost :"+engineHost);
fs.writeFileSync(logFile, "enginePort :"+enginePort);
fs.writeFileSync(logFile, "userDirectory :"+userDirectory);




/** Create personal Connection */
const XRFKEY = Math.floor(Math.pow(10, 16-1) + Math.random() * (Math.pow(10, 16) - Math.pow(10, 16-1) - 1));
const certificatesPath = './certs';
const readCert = filename => fs.readFileSync(path.resolve(__dirname, certificatesPath, filename));

var appId = '4cb2c5d0-b4d8-4805-8696-';
function createRandomAppId() {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";	
	var randomstring = '';
	for (var i=0; i<12; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}    
   appId = appId + randomstring;
}
//this function set appId first before session initiate
createRandomAppId();

const session = enigma.create({
    schema,
    url: `wss://${engineHost}:${enginePort}/app/${appId}`,
    createSocket: url => new WebSocket(url, {
      rejectUnauthorized: false,
      ca: [readCert('root.pem')],
      key: readCert('client_key.pem'),
      cert: readCert('client.pem'),
      headers: {
        'X-Qlik-User': `UserDirectory=${encodeURIComponent(userDirectory)}; UserId=${encodeURIComponent(userId)}`,
      },
    }),
  });

  var appid='';
  var sheetid='';
  var scriptheader =`  
  SET ThousandSep=',';
  SET DecimalSep='.';
  SET MoneyThousandSep=',';
  SET MoneyDecimalSep='.';
  SET MoneyFormat='$#,##0.00;-$#,##0.00';
  SET TimeFormat='h:mm:ss TT';
  SET DateFormat='M/D/YYYY';
  SET TimestampFormat='M/D/YYYY h:mm:ss[.fff] TT';
  SET FirstWeekDay=6;
  SET BrokenWeeks=1;
  SET ReferenceDay=0;
  SET FirstMonthOfYear=1;
  SET CollationLocale='en-US';
  SET CreateSearchIndexOnReload=1;
  SET MonthNames='Jan;Feb;Mar;Apr;May;Jun;Jul;Aug;Sep;Oct;Nov;Dec';
  SET LongMonthNames='January;February;March;April;May;June;July;August;September;October;November;December';
  SET DayNames='Mon;Tue;Wed;Thu;Fri;Sat;Sun';
  SET LongDayNames='Monday;Tuesday;Wednesday;Thursday;Friday;Saturday;Sunday';
  SET NumericalAbbreviation='3:k;6:M;9:G;12:T;15:P;18:E;21:Z;24:Y;-3:m;-6:μ;-9:n;-12:p;-15:f;-18:a;-21:z;-24:y';`
  
  const paramInput = JSON.parse(fs.readFileSync(SourceConnection));
  let qConnection;


  // The following four lines get the actual lib connection name and 
  // create the personal connection appending the userId to the connection name
  const startLibConn = LOAD_SCRIPT.indexOf(libConnString) + libConnString.length;
  const endLibConst = LOAD_SCRIPT.indexOf(']',startLibConn+1);
  let libConnName = LOAD_SCRIPT.substring(startLibConn,endLibConst);
  const personalLibConnName = libConnName+"_"+userId;
  fs.writeFileSync(logFile, "libConnName :"+libConnName);

  /** 
   * This is the custom part to make personal connection against sources 
   * This will triggered only in case:
   *  1) The podium.qlik.dataconnection.name is in the Connections listed in SourceConnection.json
   *  2) The users exporting to Qlik is listed in the Users section in SourceConnection.json
  */
  if(paramInput.Connections[libConnName] && paramInput.Users[userId]){



	// The following three lines get the Db prefix (Database Schema)
	const startDbPrefix = LOAD_SCRIPT.indexOf("FROM ");
	const endDbPrefix  = LOAD_SCRIPT.indexOf(".",startDbPrefix+6);
	let dbPrefix = LOAD_SCRIPT.substring(startDbPrefix+5,endDbPrefix);


	// tableName variable contain the original FROM statement (Eg. FROM NORTHWIND.EMPLOYEETERRITORIES ;)
	let tableName = LOAD_SCRIPT.substring(startDbPrefix,LOAD_SCRIPT.length);
	// In case the dbPrefix is listed in the DBs section file SourceConnection.json, than
	// the FROM statement will be replaced with the lookup value
	if(paramInput.DBs[dbPrefix]){
		tableName = LOAD_SCRIPT.substring(startDbPrefix,startDbPrefix+5) + paramInput.DBs[dbPrefix]+LOAD_SCRIPT.substring(endDbPrefix,LOAD_SCRIPT.length);
	}

	// The new SQL statement is written with the new Connection Name and the new DB prefix
	let newScript = LOAD_SCRIPT.substring(0,startLibConn) + personalLibConnName + LOAD_SCRIPT.substring(endLibConst,startDbPrefix)+tableName;
	fs.writeFileSync(logFile, "newScript :"+newScript);
	var script=scriptheader+'\n\n'+newScript;

	// Get the Connection details from SourceConnection.json file
	qConnection =  {
		qId: "",
        qName: personalLibConnName,
        qConnectionString: paramInput.Connections[libConnName].qConnectionString, 
        qType: paramInput.Connections[libConnName].qType,
        qUserName: paramInput.Users[userId].userName,
		qPassword: paramInput.Users[userId].password,
		qModifiedDate: "",
		qMeta: {
			qName: ""
		},
		qLogOn: 0
    }	
  }

  /** 
   * In case  SourceConnection.json does nt contain the connection name or user credential
   * the SQL statement is not changed
  */
  else
	  var script=scriptheader+'\n\n'+LOAD_SCRIPT
	  
  var sheetId='';


  let appHandler;

  session.open().then((global) => {
	global.createApp(appname).then((appId) => {             
		setTimeout(function () {
			console.error("REQUEST TIMEOUT");
			session.close();
			process.exit(1);
		}, 60000);
		
		appid=appId.qAppId
  		return global.openDoc(appId.qAppId)
    })
    .then( app => {
		appHandler = app;
		/** If there are the conditions, a new personal connection to the source is created */
		if(paramInput.Connections[libConnName] && paramInput.Users[userId]){
			try {
				app.createConnection(qConnection);
			} catch (e) {
				console.log("Error "+e);
			}
		}
    })
	.then(conn => { 

		appHandler
		.setScript(script)
                .then(() => appHandler.createObject({
 		   qInfo: {
     			 qType: 'sheet',
    		   },
    		  qMetaDef: {
      		    title: 'Podium_Sheet1' || '',
      		    description: 'Podium Published Dataset' || '',
    		  },
    		  rank: -1,
    		  thumbnail: { qStaticContentUrlDef: null },
    		  columns: 24,
    		  rows: 12,
    		  cells: [],
    		  qChildListDef: {
      			qData: {
        			title: '/title',
      			},
    		  },
  		}))
		.then((sheet) => {
			sheetId=sheet.id; 
                        //console.log('sheet id: ',sheet.id)
		})
		.then(() => appHandler.doReload())
		.then(() => { appHandler.doSave()})
		.then(() => {
		
						// get the qlik ticket
						const data = JSON.stringify({
							UserDirectory: userDirectory,
							UserId: userId
						});
						const options = {
							hostname: `${engineHost}`,
							port: `${proxyPort}`,
							path: '/qps/ticket?Xrfkey=' + XRFKEY,
							method: 'POST',
							timeout: 2000,
							headers: {
								'X-Qlik-Xrfkey': XRFKEY,
								'X-Qlik-User': `UserDirectory=${encodeURIComponent(userDirectory)}; UserId=${encodeURIComponent(userId)}`,
								'Content-Type': 'application/json',
								'Content-Length': data.length
							},
							key: readCert('client_key.pem'),
							cert: readCert('client.pem'),
							ca: [readCert('root.pem')],
							rejectUnauthorized: false,
							agent: false
						};
						const req = https.request(options, (res) => {

							var body = [];
							res.on('data', (chunk) => {
								body.push(chunk);
							})
							res.on('end', () => {
								body = Buffer.concat(body).toString();
								
								if (body != "") {
									var response = JSON.parse(body);
									var ticketId = (response && response.Ticket || '');
									if (ticketId) {
										console.log(`[${appid}/sheet/${sheetId}/state/insight/theme/breeze?qlikTicket=${ticketId}]`);
									} else {
										console.error("Ticket not found in response.");
									}
								} else {
									console.error("Response body was empty.");
								}
								session.close();
								process.exit(1);
							});

						});
						req.on('error', (error) => {
							console.error(error);
							session.close();
							process.exit(1);
						});
						req.write(data);
						req.end();
                })
				
		//.then(() => session.close())
		//.then(() => { process.exit(1) })
                .catch((exp) => {
                	console.log(exp)
		})

        })
        .catch((err) => {
			console.log(err);
        })
})
.catch((error) => {
	console.log(error);
});

