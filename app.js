const express = require("express");
const path = require("path");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

//MIDDLEWARE
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Initializing Server and Database
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (initError) {
    console.log(initError.message);
    process.exit(1);
  }
};
initializeDbAndServer();

// converting to camelCase
const convertDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//LOGIN API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
  dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
      console.log(jwtToken);
    }
  }
});

//GET ALL STATES LIST API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStateListQuery = `
    SELECT * FROM state ORDER BY state_id;
    `;
  const stateList = await db.all(getStateListQuery);
  response.send(
    stateList.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//GET PARTICULAR STATE API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getParticularStateQuery = `
    SELECT * FROM state WHERE state_id=${stateId};
    `;
  const stateDetail = await db.get(getParticularStateQuery);
  response.send(convertDbObjectToResponseObject(stateDetail));
});

//CREATE A NEW DISTRICT API
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `
  INSERT INTO district (district_name,
  state_id,
  cases,
  cured,
  active,
  deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//GET PARTICULAR STATE API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getParticularDistrictQuery = `
    SELECT * FROM district WHERE district_id=${districtId};
    `;
    const districtDetail = await db.get(getParticularDistrictQuery);
    response.send(convertDbObjectToResponseObject(districtDetail));
  }
);

//DELETE PARTICULAR DISTRICT API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteParticularDistrictQuery = `
    DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteParticularDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE  DISTRICT API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
  UPDATE district SET  district_name = '${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}  WHERE district_id = ${districtId};
  `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GETTING TOTAL STATS
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStats = `
    SELECT SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as  totalActive,
    SUM(deaths) as totalDeaths FROM district where state_id=${stateId};`;
    const result = await db.get(getStats);
    // console.log(result);
    response.send(result);
  }
);

//GET STATE WITH DISTRICT API
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateName = `
    SELECT  state.state_name as stateName  FROM district INNER JOIN state ON state.state_id = district.state_id WHERE district_id=${districtId};
    `;
    const stateDetails = await db.get(getStateName);
    // console.log(stateDetails);
    response.send(stateDetails);
  }
);
module.exports = app;
