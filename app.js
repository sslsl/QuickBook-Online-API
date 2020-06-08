'use strict';

require('dotenv').config();

/**
 * Require the dependencies
 * @type {*|createApplication}
 */
const express = require('express');
//const session = require('express-session');
const app = express();
const path = require('path');
const OAuthClient = require('intuit-oauth');
const bodyParser = require('body-parser');
const ngrok = process.env.NGROK_ENABLED === 'true' ? require('ngrok') : null;
const qboModel = require('./mysql_connection/qbo_models.js');
//const db=require("./mysql_connection/connection.js");
const db=require("./mysql_connection/connection.js");
var mysql=require('mysql');
//these two pachage is for scrapy data from account
const cheerio = require('cheerio');
const superagent = require('superagent');

const fetch = require('node-fetch');

// get invoice data
let invoiceData = {};
/**
 * Configure View and Handlebars
 */
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '/public')));
app.engine('html', require('ejs').renderFile);

app.set('view engine', 'html');
app.use(bodyParser.json());

const urlencodedParser = bodyParser.urlencoded({ extended: false });
var pool=mysql.createPool({
  host: 'localhost',
  user: 'olivia',
  password: '123',
  database:'qb',
  port: 3306
});

/**
 * App Variables
 * @type {null}
 */
let oauth2_token_json = null;
let redirectUri = '';

/**
 * Instantiate new Client
 * @type {OAuthClient}
 */

let oauthClient = null;

/**
 * Home Route
 */
app.get('/', function (req, res) {
  res.render('index');
});
/**
 * Get the AuthorizeUri
 */
app.get('/authUri', urlencodedParser, function (req, res) {
  oauthClient = new OAuthClient({
    clientId: req.query.json.clientId,
    clientSecret: req.query.json.clientSecret,
    environment: req.query.json.environment,
    redirectUri: req.query.json.redirectUri,
  });

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test',
  });
  res.send(authUri);
});

/**
 * Handle the callback to extract the `Auth Code` and exchange them for `Bearer-Tokens`
 */
app.get('/callback', function (req, res) {
  oauthClient
    .createToken(req.url)
    .then(function (authResponse) {
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
    })
    .catch(function (e) {
      console.error(e);
    });
    res.send('');
  });

app.get('/candidates', function (request, response) {
  let sql="select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand";
  let mydata = [];
  db.querySQL(sql,(err,rows)=>{
          if(err){
                  response.json({err:"error"})
          }
          else{
                  for(let em of rows)
                  {
                          //console.log(em);
                          let record = [em['cand_id'], em['first_name'], em['last_name'], em['address1'], em['address2'],em['city'],em['state'],em['zip'],em['email'],em['phone']];
                          mydata.push(record);
                  }
                  console.log(mydata);
                  response.writeHead(200, {
                          "Content-Type": "application/json"
                  });
                  response.write(JSON.stringify(mydata));
response.end();
//response.sendfile('./public/invoice.html')
          };
  });
});
app.get('/getAllInvoices', function (request, response) {
  let sql="select Id,Custer_name,Balance,time,DueDate,TotalAmt,DetailType from invoice";
  let mydata = [];
  db.querySQL(sql,(err,rows)=>{
          if(err){
                  response.json({err:"error"})
          }
          else{
                  for(let em of rows)
                  {
                          //console.log(em);
                          let record = [em['Id'], em['Custer_name'], em['Balance'], em['time'], em['DueDate'],em['TotalAmt'],em['DetailType']];
                          mydata.push(record);
                  }
                  console.log(mydata);
                  response.writeHead(200, {
                          "Content-Type": "application/json"
                  });
                  response.write(JSON.stringify(mydata));
response.end();
//response.sendfile('./public/invoice.html')
          };
  });
});
app.post('/updateCandidate',function(req,res){
var cand_id = req.body.cand_id;
var first_name  = req.body.first_name ;
var last_name  = req.body.last_name ;
var address1 = req.body.address;
var city = req.body.city;
var state = req.body.state;
var zip = req.body.zip;
var BillTo = req.body.BillTo;
var BillAddr = req.body.BillAddr;
db.querySQL("update cand set first_name='" + first_name + "',last_name ='" + last_name  + "',address1 ='" + address1  + "',city ='" + city + "',state ='" + state  + "',zip ='" + zip  + "' where cand_id=" + cand_id, function (err, rows) {
if (err) {
      res.end('Update error：' + err);
  } else {
    res.json('Update success');
  }
});
});

// app.get('/createInvoice', function (request, response) {
// 	let sql="select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand";
// 	let mydata = [];
// 	db.querySQL(sql,(err,rows)=>{
// 		if(err){
// 			response.json({err:"error"})
// 		}
// 		else{
//       response.render('invoice')
// 			for(let em of rows)
// 			{
// 				//console.log(em);
// 				let record = [em['cand_id'], em['first_name'], em['last_name'], em['address1'], em['address2'],em['city'],em['state'],em['zip'],em['email'],em['phone']];
// 				mydata.push(record);
// 			}
// 			console.log(mydata);
// 			response.writeHead(200, {
// 				"Content-Type": "application/json"
// 			});
// 			response.write(JSON.stringify(mydata));
//       // response.end();
//       response.sendfile('./public/invoice.html')
// 		};
// 	});
// });

app.get('/candidates', function (request, response) {
	let sql="select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand";
	let mydata = [];
	db.querySQL(sql,(err,rows)=>{
		if(err){
			response.json({err:"error"})
		}
		else{
			for(let em of rows)
			{
				//console.log(em);
				let record = [em['cand_id'], em['first_name'], em['last_name'], em['address1'], em['address2'],em['city'],em['state'],em['zip'],em['email'],em['phone']];
				mydata.push(record);
			}
			console.log(mydata);
			response.writeHead(200, {
				"Content-Type": "application/json"
			});
			response.write(JSON.stringify(mydata));
      response.end();
      //response.sendfile('./public/invoice.html')
		};
	});
});

app.get('/getAllInvoices', function (request, response) {
	let sql="select Id,Custer_name,Balance,time,DueDate,TotalAmt,DetailType from invoice";
	let mydata = [];
	db.querySQL(sql,(err,rows)=>{
		if(err){
			response.json({err:"error"})
		}
		else{
			for(let em of rows)
			{
				//console.log(em);
				let record = [em['Id'], em['Custer_name'], em['Balance'], em['time'], em['DueDate'],em['TotalAmt'],em['DetailType']];
				mydata.push(record);
			}
			console.log(mydata);
			response.writeHead(200, {
				"Content-Type": "application/json"
			});
			response.write(JSON.stringify(mydata));
      response.end();
      //response.sendfile('./public/invoice.html')
		};
	});
});
app.post('/updateCandidate',function(req,res){
  var cand_id = req.body.cand_id;
  var first_name  = req.body.first_name ;
  var last_name  = req.body.last_name ;
  var address1 = req.body.address;
  var city = req.body.city;
  var state = req.body.state;
  var zip = req.body.zip;
  var BillTo = req.body.BillTo;
  var BillAddr = req.body.BillAddr;
  db.querySQL("update cand set first_name='" + first_name + "',last_name ='" + last_name  + "',address1 ='" + address1  + "',city ='" + city + "',state ='" + state  + "',zip ='" + zip  + "' where cand_id=" + cand_id, function (err, rows) {
      if (err) {
            res.end('Update error：' + err);
        } else {
          res.json('Update success');
        }
    });
});


/**
 * Display the token : CAUTION : JUST for sample purposes
 */
app.get('/retrieveToken', function (req, res) {
  res.send(oauth2_token_json);
});

/**
 * Refresh the access-token
 */
app.get('/refreshAccessToken', function (req, res) {
  oauthClient
    .refresh()
    .then(function (authResponse) {
      console.log(`The Refresh Token is  ${JSON.stringify(authResponse.getJson())}`);
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
      res.send(oauth2_token_json);
    })
    .catch(function (e) {
      console.error(e);
    });
});

/**
 * getCompanyInfo ()
 */
app.get('/getCompanyInfo', function (req, res) {
  const companyID = oauthClient.getToken().realmId;

  const url =
    oauthClient.environment == 'sandbox'
      ? OAuthClient.environment.sandbox
      : OAuthClient.environment.production;

  oauthClient
    .makeApiCall({ url: `${url}v3/company/${companyID}/companyinfo/${companyID}` })
    .then(function (authResponse) {
      console.log(`The response for API call is :${JSON.stringify(authResponse)}`);
      res.send(JSON.parse(authResponse.text()));
    })
    .catch(function (e) {
      console.error(e);
    });
});
app.get('/connectMysql',function(req,res,next){
  //get_accounts(req, res, req.body.AccountId);
  var sql="select * from test";
  db.querySQL(sql,(err,rows)=>{
    if(err){
      res.json({err:"unable to connect with mysql"})
    }
    else{
      res.json({list:rows})
    }
  })
});


/**
 * disconnect ()
 */
app.get('/disconnect', function (req, res) {
  console.log('The disconnect called ');
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.OpenId, OAuthClient.scopes.Email],
    state: 'intuit-test',
  });
  res.redirect(authUri);
});

function refresh_token(req, res,AccountId,oldrefresh_token,callback_function){
  var auth = (new Buffer(config.clientId + ':' + config.clientSecret).toString('base64'));
  var postBody = {
      url: config.token_endpoint,
      headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + auth,
      },
      form: {
          grant_type: 'refresh_token',
          refresh_token: oldrefresh_token
      }
  };

  request.post(postBody, function (err, res, data) {
      var accessToken = JSON.parse(res.body);
      if(accessToken.access_token){
          pool.query('UPDATE account_quickbooks_keys SET   AccessToken = ?, RefreshToken = ?, Expires = ? WHERE Account = ?', [accessToken.access_token,accessToken.refresh_token,accessToken.expires_in,AccountId], function (error, results, fields) {
              if (error) throw error;
            });
      }

  });

  eval(callback_function+"(req, res,AccountId)");
}

app.post('/createInvoice', function(req,res){
  const {body} = req;
  createInvoice(res);
})

function getInvoiceData(res, clientName) {
  fetch('https://sandbox-quickbooks.api.intuit.com/v3/company/123146162820179/query?minorversion=30', {
          method: 'post',
          body:    `select * from Customer where CompanyName = '${clientName}'`,
          headers: { 'Content-Type': 'application/text',
                     "Accept": "application/json",
                     "Authorization": "bearer " + token }}).then(res => res.json())
      .then(function(json) {
        console.log(json.QueryResponse);
        const client = json.QueryResponse.Customer[0];
        invoiceData.clientId = client.Id;
        invoiceData.email = client.PrimaryEmailAddr.Address;
        console.log(`clientEmail: ${invoiceData.email}`);
        let reply = "Customer found! What is the payment amount?";
        res.send(JSON.stringify({fulfillmentText : reply}));
      });
}

function createInvoice(res) {
  const token = JSON.parse(oauth2_token_json).access_token;
  
   let body = {
    "Line": [
      {
        "Description":"Subslate1",
        "DetailType": "SalesItemLineDetail",
        "Amount": 12.75,
        "SalesItemLineDetail": {
            "Qty": 1,
            "UnitPrice": 12.75,
            "ItemRef": {
              "value": "2"  //subslate id
          }
        }
      },
      {
        "Description":"Subslate2",
        "DetailType": "SalesItemLineDetail",
        "Amount":110.0,
        "SalesItemLineDetail": {
            "Qty": 1,
            "UnitPrice": 110.0,
            "ItemRef": {
              "value": "1"
          }
        }
      }
    ],
    "CustomerRef": {
      "value": "1",
      "name":"olivia wu"
      //company name
    },
    "DueDate": "2014-10-19",
    "BillAddr": {
        "City": "Middlefield",
        "Line1": "5647 Cypress Hill Ave.",
        "PostalCode": "94304",
        "CountrySubDivisionCode": "CA"
      }
  };
  fetch('https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365049179780/invoice?minorversion=51', {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', "Accept": "application/json", "Authorization": "bearer " + token }})
    .then(res => res.json())
    .then(function(json) {
      console.log('Invoice created');
      console.log(JSON.stringify(json));

      pool.getConnection(function(err,connection){
        //var jsonData = JSON.stringify(json);
        var gdata = json;
        var sql = "insert into invoice (Id,SyncToken,CustomField_id,CustomField_name,DocNumber,TxnDate,DueDate,TotalAmt,Balance,BillAddr_id,BillAddr,ShipAddr_id,ShipAddr,ShipFromAddr_id,ShipFromAddr,time,Line_id,Line_num,Line_amount,DetailType) values ('"+gdata.Invoice.Id+"','"+gdata.Invoice.SyncToken+"','"+gdata.Invoice.CustomField[0].DefinitionId+"','"+gdata.Invoice.CustomField[0].Name+"','"+gdata.Invoice.DocNumber+"','"+gdata.Invoice.TxnDate+"','"+gdata.Invoice.DueDate+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Balance+"','"+gdata.Invoice.BillAddr.Id+"','"+gdata.Invoice.BillAddr.Line1+" "+gdata.Invoice.BillAddr.City +" "+ gdata.Invoice.BillAddr.CountrySubDivisionCode +" "+ gdata.Invoice.BillAddr.PostalCode+"','"+gdata.Invoice.ShipAddr.Id+"','"+gdata.Invoice.ShipAddr.Line1+"','"+gdata.Invoice.ShipFromAddr.Id+"','"+gdata.Invoice.ShipFromAddr.Line1+" "+ gdata.Invoice.ShipFromAddr.Line2+"','"+gdata.time+"','"+gdata.Invoice.Line[0].Id+"','"+gdata.Invoice.Line[0].LineNum+"','"+gdata.Invoice.Line[0].Amount+"','"+gdata.Invoice.Line[0].DetailType+"')";

        connection.query(sql,function(err,result){
          if(result){
            res.json({result:"success save invoice data"})
          }else{
            res.json({err:"unable to connect with mysql"})
          }
        });
        // var sqlLine;
        // for(var i=0;i<gdata.Line.length;i++){
        //   sqlLine = "insert into invoice () values "
        // }
      })
  });
}
app.get('/candidates/:cand_id',function(req,res){
 // var  cand_id = req.query.cand_id;
  var json  = req.params;
  var cand_id = json["cand_id"];
if(cand_id){
 db.querySQL("select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand where cand_id=" + cand_id, function (err, rows) {
    if (err) {
          res.end('Search candidate  error：' + err);
      } else {
        res.json({list:rows});
        //res.json('Update success');
      }
  });
}else{
  db.querySQL("select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand" , function (err,rows){
    if (err) {
      res.end('Search candidate  error：' + err);
  } else {
    res.json({list:rows});
    //res.json('Update success');
  }
})
}
})

/**
* Start server on HTTP (will use ngrok for HTTPS forwarding)
*/
const server = app.listen(process.env.PORT ||3300, () => {
console.log(`💻 Server listening on port ${server.address().port}`);
if (!ngrok) {
  redirectUri = `${server.address().port}` + '/callback';
  console.log("success!");
  }
});

/**
* Optional : If NGROK is enabled
*/
if (ngrok) {
console.log('NGROK Enabled');
ngrok
.connect({ addr: process.env.PORT || 3300 })
.then((url) => {
  redirectUri = `${url}/callback`;
  console.log("success!");
})
.catch(() => {
    process.exit(1);
  });
}






