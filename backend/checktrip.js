const { Client } = require('pg');
require('dotenv').config({path: __dirname + '/.env'});
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (l,s,p)=>{try{const r=await c.query(s,p);console.log('###',l);console.dir(r.rows,{depth:5,maxArrayLength:100});}catch(e){console.log('###',l,'ERR:',e.message);}};
  await q('trip 43da27bf full row', `select id, school_id, driver_id, vehicle_id, route_id, status, direction, started_at from trips where id='43da27bf-1203-431d-97e1-8af09d92d246'`);
  await q('driver row for JWT sub', `select id, school_id, user_id from drivers where id='a158b532-49be-40ea-b513-7ed3746bd511'`);
  await q('driver row by any user_id match', `select id, school_id, user_id from drivers where user_id='a158b532-49be-40ea-b513-7ed3746bd511'`);
  await q('users row for JWT sub', `select id, school_id, email, role_id from users where id='a158b532-49be-40ea-b513-7ed3746bd511'`);
  await q('drivers table columns', `select column_name from information_schema.columns where table_name='drivers' order by ordinal_position`);
  await c.end();
})();
