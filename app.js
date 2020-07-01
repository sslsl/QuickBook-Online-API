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
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With, Current-Page');
 // res.header("Access-Control-Allow-Headers", "X-Requested-With");
 // res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
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

/**
 * Get all candidates info from mysql
 */
app.get('/candidates', function (req, res) {
  // let sql="select cand.cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone,status from cand  left join transaction on cand.cand_id=transaction.cand_id";
   var sql = "SELECT  c.cand_id,c.county,c.ixcode,c.distcode,c.subcode,c.racecode,c.seatcode, c.office, c.office_id, c.first_name,c.last_name,c.occupation, c.party, c.address1,c.address2,c.city,c.state,c.zip,c.email,c.phone, t.status, t.balance, t.transactionTime,t.transactionId, t.invoiceId FROM  cand c LEFT JOIN transaction t  ON  c.cand_id = t.candId"
 
     db.querySQL(sql,function(err0,res0){
         if(err0){
                res.json({err0:"Unable to get all candidates"});
         }else{
                JSON.stringify(res0)
                res.json({candidate:res0})
          }
    })
  })
 
 /**
  * Get all invoice from mysql 
  */
 app.get('/invoices', function (req, res) {
   let sql="select  Id,time,totalAmt,customerName,Balance,dueDate,billAddr,shipAddr,subslateName  from invoice";
   db.querySQL(sql,(err,rows)=>{
     if(err){
       res.json({err:"Unable to get all invoices"})
     }
     else{
       res.json({result:rows})
     }
   })
 });

 /**
 * Update candidate info 
 */
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
              res.send({status:"success",message:"Update success"});
          }
  });
});

/**
* Click record payment 
*/
app.post('/recordPayment/:cand_id',function(req,res){
  var json  = req.params;
  var cand_id = json["cand_id"];
  var amount = req.body.amount;
  var invoiceId = req.body.item;
 //for(var i=0;i<req.body.length;i++){
      pool.getConnection(function(err,connection){
       // amount = req.body[i].amount;
       // invoiceId = req.body[i].item;
        var sqls = ["select first_name from cand where cand_id = "+ cand_id ,"select TotalAmt from invoice where Id = '" +invoiceId+"'","insert into payment (cand_id,amount,invoiceId) values ('"+cand_id+"','"+amount+"','"+invoiceId+"')","insert into transaction (candId,oncePayment,transactionType,invoiceId) values ('"+cand_id+"','"+amount+"','record payment','"+invoiceId+"')","update cand set status='payment recorded' where cand_id = '"+cand_id+"'"];
//       console.log(i);
        connection.query(sqls[0],function(err0,result0){
        if(err0){
                console.log(err0);
        }else if(result0.length!=0){
                connection.query(sqls[1],function(err1,result1){
                        if(err1){
                                console.log(err1)
                         }else if(result1.length!=0){
                                connection.query(sqls[2],function(err2,result2){
                                        if(err2){
                                                console.log(err2)
                                        }else{
                                                connection.query(sqls[3],function(err3,result3){
                                                        if(err3){
                                                                console.log(err3)
                                                        }else{
                                                                 getResult(invoiceId,amount,cand_id,res)
                                                        }
                                                })
                                                console.log(result2)
                                        }
                                })
                        }else{
                                res.status(404).send("Invoice ID not found!")
                        }
                });
            }else{
                 res.status(404).send("Candidate does not exist!")
                }
        });
   });
  });

  function getResult(invoiceId,amount,cand_id,res){
          var result = {};
  //      if(invoiceId.length==1){
                  var sql = "select sum(oncePayment) as balancePaid  from transaction where candId = '" +cand_id+"' and invoiceId = '"+invoiceId+"'";
                  db.querySQL(sql,function(err0,res0){
                     if(err0){
                              console.log(err0);
                     }else if(res0.length!=0){
                          console.log(res0.length)
                          var tmp = res0[0].balancePaid;
                          var temp = tmp + amount;
                          result.balancePaid = temp;
                          result.invoiceId = invoiceId;
                          JSON.stringify(result)
                          res.send(result)
                          db.querySQL("update invoice set balancePaid = '" +temp+"' where Id =" + invoiceId,function(err,rows){
                            if(err){
                                  console.log(err)
                            }else{
                                  console.log("success update invoice balance paid")
                            }
                         })
                   }else{
                          res.status(404).send("Invoice ID not found!")
                  }
              })
  }
  

/**
/**
 * Display the token 
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

/**
 * Connect to QBO and create invoice 
 */
app.post('/createInvoice', function(req,res){
  const {body} = req;
  createInvoice(req,res);
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
function createInvoice(req,res) {
  const token = JSON.parse(oauth2_token_json).access_token;
   var Amount = req.body.Line[0].Amount;
   let body = {
    "Line": [
      {
        "Description":"Subslate1",
        "DetailType": "SalesItemLineDetail",
        "Amount": Amount,
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
      },
    "BillEmail": {
      "Address": "wuhaoyu@usc.edu"
    },
    "EmailStatus": "EmailSent"
  };
 
  console.log(body.CustomerRef.value);
  fetch('https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365049179780/invoice?minorversion=51', {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', "Accept": "application/json", "Authorization": "bearer " + token }})
    .then(res => res.json())
    .then(function(json) {
      console.log('Invoice created');
      console.log(JSON.stringify(json));
  //    sendInvoice(res, json.Invoice.Id);
      sendInvoice(res, json.Invoice.Id, json.Invoice.BillEmail.Address);

      /*
      save invoice data to mysql(invoice table)
      */
      pool.getConnection(function(err,connection){
         var gdata = json;
//var connection =  mysql.createConnection( { multipleStatements: true } );  
        var sqls =[ "insert into transaction (transactionTime,candId,balance,invoiceId,status,transactionType) values ('"+gdata.time+"','"+body.CustomerRef.value+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Id+"','invoice sent','create invoice')","insert into invoice (Id,SyncToken,CustomField_id,CustomField_name,DocNumber,TxnDate,dueDate,TotalAmt,Balance,BillAddr_id,billAddr,ShipAddr_id,shipAddr,ShipFromAddr_id,ShipFromAddr,time,Line_id,Line_num,Line_amount,DetailType) values ('"+gdata.Invoice.Id+"','"+gdata.Invoice.SyncToken+"','"+gdata.Invoice.CustomField[0].DefinitionId+"','"+gdata.Invoice.CustomField[0].Name+"','"+gdata.Invoice.DocNumber+"','"+gdata.Invoice.TxnDate+"','"+gdata.Invoice.DueDate+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Balance+"','"+gdata.Invoice.BillAddr.Id+"','"+gdata.Invoice.BillAddr.Line1+" "+gdata.Invoice.BillAddr.City +" "+ gdata.Invoice.BillAddr.CountrySubDivisionCode +" "+ gdata.Invoice.BillAddr.PostalCode+"','"+gdata.Invoice.ShipAddr.Id+"','"+gdata.Invoice.ShipAddr.Line1+"','"+gdata.Invoice.ShipFromAddr.Id+"','"+gdata.Invoice.ShipFromAddr.Line1+" "+ gdata.Invoice.ShipFromAddr.Line2+"','"+gdata.time+"','"+gdata.Invoice.Line[0].Id+"','"+gdata.Invoice.Line[0].LineNum+"','"+gdata.Invoice.Line[0].Amount+"','"+gdata.Invoice.Line[0].DetailType+"')","update cand set status='invoice sent' where cand_id = '"+body.CustomerRef.value+"'"];

// var sql_2 = "insert into invoice (Id,SyncToken,CustomField_id,CustomField_name,DocNumber,TxnDate,DueDate,TotalAmt,Balance,BillAddr_id,BillAddr,ShipAddr_id,ShipAddr,ShipFromAddr_id,ShipFromAddr,time,Line_id,Line_num,Line_amount,DetailType) values ('"+gdata.Invoice.Id+"','"+gdata.Invoice.SyncToken+"','"+gdata.Invoice.CustomField[0].DefinitionId+"','"+gdata.Invoice.CustomField[0].Name+"','"+gdata.Invoice.DocNumber+"','"+gdata.Invoice.TxnDate+"','"+gdata.Invoice.DueDate+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Balance+"','"+gdata.Invoice.BillAddr.Id+"','"+gdata.Invoice.BillAddr.Line1+" "+gdata.Invoice.BillAddr.City +" "+ gdata.Invoice.BillAddr.CountrySubDivisionCode +" "+ gdata.Invoice.BillAddr.PostalCode+"','"+gdata.Invoice.ShipAddr.Id+"','"+gdata.Invoice.ShipAddr.Line1+"','"+gdata.Invoice.ShipFromAddr.Id+"','"+gdata.Invoice.ShipFromAddr.Line1+" "+ gdata.Invoice.ShipFromAddr.Line2+"','"+gdata.time+"','"+gdata.Invoice.Line[0].Id+"','"+gdata.Invoice.Line[0].LineNum+"','"+gdata.Invoice.Line[0].Amount+"','"+gdata.Invoice.Line[0].DetailType+"')"
connection.query(sqls[0],function(err0,result0){
  if(err0){
          console.log(err0);
  }else{
          connection.query(sqls[1],function(err1,result1){
                  if(err1){
                          console.log(err1)
                  }else{
                          connection.query(sqls[2],function(err2,result2){
                                  if(err2){
                                          console.log(err2)
                                  }else{
                                          res.json({result1:"Invoice saved and transaction changed successful!"});
                                  }
                          })
                  }
          });
      }
  });
})
});
}


function sendInvoice(res,invoiceId,invoiceEmailAddr){
  //function sendInvoice(res,invoiceId){   
  const token = JSON.parse(oauth2_token_json).access_token;
   fetch('https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365049179780/invoice/${invoiceId}/send?sendTo=${invoiceEmailAddr}&minorversion=51', {
  //  fetch('https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365049179780/invoice/${invoiceId}/send', {
      method: 'post',
      headers: { 'Content-Type': 'application/octet-stream',
      "Accept": "application/json",
      "Authorization": "bearer " + token }}).then(res => res.json())
      .then(function(json) {
        console.log('Invoice sent');
   //     let reply = "Invoice sent.";
     //   res.send(JSON.stringify({fulfillmentText : reply}));
    });
  }
  
  /**
 * Click resend invoice 
 */

app.post('/resendInvoice', function(req,res){
  var invoiceId = req.body.invoiceEmailAddr;
  var invoiceEmailAddr = req.body.invoiceEmailAddr;
  sendInvoice(res,invoiceId,invoiceEmailAddr);
  res.send({status:"success",message:"Resend invoice success"});
})

/**
 * Get specific candidate info 
 */
app.get('/candidates/:cand_id',function(req,res){
 // var  cand_id = req.query.cand_id;
  var json  = req.params;
  var cand_id = json["cand_id"];
if(cand_id){
  var sqls = ["SELECT  c.cand_id,c.county,c.ixcode,c.distcode,c.subcode,c.racecode,c.seatcode, c.office, c.office_id, c.first_name,c.last_name,c.occupation, c.party, c.first_name,c.last_name,c.address1,c.address2,c.city,c.state,c.zip,c.email,c.phone, c.status FROM  cand c where c.cand_id=" + cand_id,"SELECT i.Id,i.totalAmt,i.customerName,i.dueDate,i.billAddr,i.shipAddr,i.subslateName,i.candId  FROM invoice i  where i.candId=" + cand_id,"select transactionId, transactionTime, transactionType, invoiceId  from transaction  where candId=" + cand_id,"select sum(oncePayment) as sum  from transaction where candId = " +cand_id];
  var invoice = [];
  var transaction = [];
  db.querySQL(sqls[0],function(err0,res0){
      if(err0){
              console.log(err0);
      }else if(res0.length!=0){
              console.log(res0)
              db.querySQL(sqls[1],function(err1,res1){
                      if(err1){
                              console.log(err1)
                      }else if(res1.length!=0){
                              for (var i in res1){
                                      invoice.push(res1[i])
                              }
                              res0[0].invoice = invoice;
                              db.querySQL(sqls[2],function(err2,res2){
                                      if(err2){
                                              console.log(err2);
                                      }else{
                                              for(var i in res2){
                                                      transaction.push(res2[i])
                                              }
                                              res0[0].transaction = transaction;
                                              var result =  new Object();
                                              result.cand_id =  res0[0].cand_id;
                                              result.ixcode =  res0[0].ixcode;
                                              result.distcode =  res0[0].distcode;
                                              result.subcode = res0[0].subcode;
                                              result.racecode = res0[0].racecode
                                              result.seatcode = res0[0].seatcode
                                              result.office = res0[0].office
                                              result.office_id = res0[0].office_id
                                              result.first_name = res0[0].first_name;
                                              result.last_name = res0[0].last_name;
                                              result.address = res0[0].address1;
                                              result.city = res0[0].city;
                                              result.state = res0[0].state;
                                              result.zip = res0[0].zip;
                                              result.email = res0[0].email;
                                              result.phone = res0[0].phone;
                                              result.status = res0[0].status;
                                              result.invoice = res0[0].invoice;
                                              result.transaction = res0[0].transaction;
                                              db.querySQL(sqls[3],function(err3,res3){
                                                      if(err3){
                                                              console.log(err3)
                                                      }else{
                                                        var total = res3[0].sum
                                                        var balance = invoice[0].totalAmt - total;
                                                        result.balance = balance;
                                                        result.totalPayment = total;
                                                        //console.log(total)
                                                        JSON.stringify(result)
                                                        res.send(result)
                                                }
                                        })
                                        //JSON.stringify(result)
                                        //res.send(result)
                                }
                        });
                }else{
                  var result =  new Object();
                                  result.cand_id =  res0[0].cand_id;
                                  result.ixcode =  res0[0].ixcode;
                                  result.distcode =  res0[0].distcode;
                                  result.subcode = res0[0].subcode;
                                  result.racecode = res0[0].racecode
                                  result.seatcode = res0[0].seatcode
                                  result.office = res0[0].office
                                  result.office_id = res0[0].office_id
                                  result.first_name = res0[0].first_name;
                                  result.last_name = res0[0].last_name;
                                  result.address = res0[0].address1;
                                  result.city = res0[0].city;
                                  result.state = res0[0].state;
                                  result.zip = res0[0].zip;
                                  result.email = res0[0].email;
                                  result.phone = res0[0].phone;
                                  result.status = res0[0].status;
                                  result.invoice = [];
                                  result.transaction = [];
                                  JSON.stringify(result);
                                  res.send(result);
          }

        })
    }else{
      res.status(404).send("Candidate does not exist")
    }
  })
}else{
db.querySQL("select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand" , function (err,rows){
if (err) {
res.end('Fail to get all candidates:：' + err);
} else {
res.json({list:rows});
//res.json('Update success');
}
})
}
})

/**
 * Get specific candidate invoice 
 */
app.get('/invoices/:cand_id',function(req,res){
  // var  cand_id = req.query.cand_id;
   var json  = req.params;
   var cand_id = json["cand_id"];
 if(cand_id ){
  db.querySQL("select i.Id,i.totalAmt,i.customerName,i.dueDate,i.billAddr,i.shipAddr,i.subslateName,i.candId  FROM invoice i  where i.candId=" + cand_id, function (err, rows) {
       var invoice = []
       if (err) {
           res.end('Fail to get invoice data:' + err);
       } else {
         for (var i in rows){
                 invoice.push(rows[i])
         }
         res.json({invoice:invoice});
       }
     })
 }else{
   db.querySQL("select Id,time,totalAmt,Custer_name,Balance,DueDate,BillAddr,ShipAddr from invoice" , function (err,rows){
     if (err) {
       res.end('Cannot get all invoices：' + err);
   } else {
     res.json({list:rows});
     //res.json('Update success');
   }
 })
 }
 })

 app.get('/balance',function getbalance(req,res){
  var cand_id = req.body.cand_id;
  var sql = "select sum(oncePayment) from transaction where candId = '"+cand_id+"'";
  db.querySQL(sql,(err,rows)=>{
          if(err){
                  res.json({err:"Fail to get total balance"})
          }
          else{
                  res.json({result:rows})
           }
  });
})

function getbalance(cand_id){
  var sql = "select sum(oncePayment) from transaction where candId = '"+cand_id+"'";
  var balance;
  db.querySQL(sql,(err,rows)=>{
          if(err){
                  console.log({err:"Fail to get total balance"})
          }
          else{
                   balance = rows;
                  console.log(balance);
          }
  })
  return balance;
}

/**
 * Click resend invoice 
 */
app.post('/resendInvoice', function(req,res){
  var invoiceId = req.body.invoiceEmailAddr;
  var invoiceEmailAddr = req.body.invoiceEmailAddr;
  sendInvoice(res,invoiceId,invoiceEmailAddr);
  res.send({status:"success",message:"Resend invoice success"});
})

app.get('/recordPayment',function(req,res){
  var sql = "insert into payment (cand_id,slateName,amount) values (cand_id,slateName,amount)"
  var slateName = req.body.slateName;
  var amount = req.body.amount;
  var cand_id = req.body.cand_id;
  //var balance = 
  db.querySQL( sql, function (err, rows) {
    if (err) {
          res.end('Payment insert error：' + err);
      } else {
        res.json('Payment insert success');
      }
    });
});

/**
 * Get specific candidate transaction history
 */
app.get('/transaction/:cand_id',function(req,res){
 // var  cand_id = req.query.cand_id;
  var json  = req.params;
  var cand_id = json["cand_id"];
 db.querySQL("select transactionId,transactionTime,transactionType,invoiceId from transaction  where candId=" + cand_id, function (err, rows) {
      var transaction = []
      if (err) {
          res.end('Fail to get transaction history:' + err);
      } else {
        for (var i in rows){
                transaction.push(rows[i])
        }
        res.json({transaction:transaction});
    }
  });
});

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
  
  