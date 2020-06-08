const pool=require("./connection.js");

function get_qb_login_details(id,cb)
{
   pool.query(" SELECT * FROM test",function (error, results, fields) {
    if (error) throw error;
       cb(results);
   })
}

module.exports= {get_qb_login_details:get_qb_login_details}