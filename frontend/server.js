const express = require('express');
const session = require('express-session');
const path = require('path');
// Require our NBA API utility
const nbaApi = require('./utils/nbaApi');
// Add the nbaScores utility
const nbaScores = require('./utils/nbaScores');
const app = express();
const port = process.env.PORT || 3000;
// Add fetch for making HTTP requests
const fetch = require('node-fetch');

// All the Middleware

//Configure Session Middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {}
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set the correct MIME types for CSS files
app.use((req, res, next) => {
    if (req.path.endsWith('.css')) {
        res.type('text/css');
    }
    next();
});

// Serve static files (like images, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

//Track session Details
app.use((req, res, next) => {
    if (!req.session.startTime) {
        // Initialize session data
        req.session.startTime = Date.now();
        req.session.pageCount = 0;
        req.session.isLoggedIn = false;
    }
    // Increase page view count on each request
    req.session.pageCount++;
    next();
});

// Serve the homepage
app.get('/', (req, res) => {
    const sessionStart = new Date(req.session.startTime);
    res.render('homepage', {
        title: 'My Homepage',
        sessionStart: sessionStart.toLocaleTimeString(),
        pageCount: req.session.pageCount
    });
});

// Serve the login page
app.get('/loginpage', (req, res) => {
    res.render('loginpage', {
        title: 'Login'
    });
});

// Serve the teams page - Updated to use the SportRadar API
app.get('/teams', async (req, res) => {
    try {
        // Fetch teams from the API
        const teams = await nbaApi.getAllTeams();
        
        res.render('teams', {
            title: 'NBA Teams',
            teams: teams
        });
    } catch (error) {
        console.error('Error fetching teams data:', error);
        // Fallback to rendering the page without team data
        res.render('teams', {
            title: 'NBA Teams',
            teams: [],
            error: 'Unable to load team data. Please try again later.'
        });
    }
});

// Updated scores route without mock data
app.get('/scores', async (req, res) => {
    try {
        // Get the date from query parameter or use today's date as default
        let dateParam = req.query.date;
        
        // If no date is provided in the query, use today's date
        if (!dateParam) {
            const today = new Date();
            dateParam = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
        
        // Parse the date for display and navigation
        const date = new Date(dateParam);
        
        // Format the date for display
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Calculate previous and next day for navigation
        const prevDay = new Date(date);
        prevDay.setDate(date.getDate() - 1);
        const prevDayFormatted = prevDay.toISOString().split('T')[0];
        
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        const nextDayFormatted = nextDay.toISOString().split('T')[0];
        
        // Fetch games for the selected date
        const games = await nbaScores.getGamesForDate(dateParam);
        const formattedGames = await nbaScores.formatGamesData(games);
        
        res.render('scores', {
            title: 'NBA Scores',
            date: formattedDate,
            scores: formattedGames,
            prevDay: prevDayFormatted,
            nextDay: nextDayFormatted
        });
    } catch (error) {
        console.error('Error in scores route:', error);
        res.render('error', {
            message: 'Unable to load scores at this time',
            error: {
                status: 500,
                stack: process.env.NODE_ENV === 'development' ? error.stack : ''
            }
        });
    }
});

// serve the Trending Page
app.get('/trending', (req, res) => {
    res.render('news', {
        title: 'News'
    });
});


app.get('/statistics', async (req, res) => {
    try {
        
        const leadersData = await nbaApi.getLeagueLeaders();
        
        res.render('statistics', {
            title: 'Statistics',
            leaders: leadersData
        });
    } catch (error) {
        console.error('Error fetching league leaders:', error);
        
        res.render('statistics', {
            title: 'Statistics',
            leaders: null,
            error: 'Unable to load statistics data. Please try again later.'
        });
    }
});

// Serve the Predictions Page
app.get("/predictions", (req, res) => {
  res.render("predictions", {
    title: "Predictions",
  });
});

// Add a new API endpoint to get predictions from the ML API
app.get('/api/prediction', async (req, res) => {
  try {
    // Get team parameters from query
    const { team1, team2 } = req.query;
    
    if (!team1 || !team2) {
      return res.status(400).json({ error: 'Both team1 and team2 parameters are required' });
    }
    
    // Call the ML API
    const mlApiUrl = process.env.ML_API_URL || 'http://localhost:5000';
    const response = await fetch(`${mlApiUrl}/api/predict?teams=${team1},${team2}`);
    
    if (!response.ok) {
      throw new Error(`ML API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching prediction:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// Serve the Contact Us Page
app.get("/contactus", (req, res) => {
    res.render("contactus", {
      title: "Contact Us",
    });
  });

// Single route to handle all team pages - Updated to use team ID for API lookup
app.get('/teams/:teamId', async (req, res) => {
    try {
        const teamId = req.params.teamId;
        
        // Fetch team profile and roster data in parallel
        const [teamProfile, teamRoster] = await Promise.all([
            nbaApi.getTeamProfile(teamId),
            nbaApi.getTeamRoster(teamId)
        ]);
        
        // Generate the best possible logo URL for this team
        const fullName = `${teamProfile.market} ${teamProfile.name}`;
        const teamLogoUrl = require('./utils/teamLogos').getBestLogoUrl(teamId, fullName);
        
        res.render('team', { 
            teamName: fullName,
            teamId: teamId,
            teamLogoUrl: teamLogoUrl,
            team: teamProfile,
            roster: teamRoster.players
        });
    } catch (error) {
        console.error('Error fetching team data:', error);
        res.status(404).render('error', { 
            message: 'Team not found or unable to load team data',
            error: {
                status: 404,
                stack: process.env.NODE_ENV === 'development' ? error.stack : ''
            }
        });
    }
});

// Update the game details route to handle missing data
app.get('/game/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        
        // Get boxscore data only
        const boxscore = await nbaScores.getBoxscore(gameId);
        
        if (!boxscore) {
            return res.status(404).render('error', { 
                message: 'Game not found',
                error: { status: 404 }
            });
        }
        
        // Get team logos
        const homeTeamLogo = require('./utils/teamLogos').getLogoByTeamName(boxscore.home.name);
        const awayTeamLogo = require('./utils/teamLogos').getLogoByTeamName(boxscore.away.name);
        
        // Ensure venue information exists
        if (!boxscore.venue) {
            boxscore.venue = {
                name: 'Unknown Venue',
                city: '',
                state: ''
            };
        }
        
        res.render('game-details', {
            title: `${boxscore.away.name} @ ${boxscore.home.name}`,
            game: boxscore,
            homeTeamLogo: homeTeamLogo,
            awayTeamLogo: awayTeamLogo
        });
    } catch (error) {
        console.error('Error fetching game details:', error);
        res.status(500).render('error', { 
            message: 'Failed to load game details',
            error: {
                status: 500,
                stack: process.env.NODE_ENV === 'development' ? error.stack : ''
            }
        });
    }
});

// Add an API route to get all teams (for client-side JavaScript if needed)
app.get('/api/teams', async (req, res) => {
    try {
        const teams = await nbaApi.getAllTeams();
        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams data:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Add a test route for specific team ID
app.get('/test-team/:teamId', async (req, res) => {
  try {
    const teamId = req.params.teamId || '583eca2f-fb46-11e1-82cb-f4ce4684ea4c'; // Default to Boston Celtics
    
    console.log(`Testing team API with ID: ${teamId}`);
    // Use getTeamProfile instead of getTeamById to get standings data
    const teamData = await nbaApi.getTeamProfile(teamId);
    
    // Generate the best possible logo URL
    const fullName = `${teamData.market} ${teamData.name}`;
    const teamLogoUrl = require('./utils/teamLogos').getBestLogoUrl(teamId, fullName);
    
    res.render('team', { 
      teamName: fullName,
      teamId: teamId,
      teamLogoUrl: teamLogoUrl,
      team: teamData,
      roster: teamData.players || []
    });
  } catch (error) {
    console.error('Error in test-team route:', error);
    res.status(500).render('error', { 
      message: 'Failed to load team data',
      error: {
        status: 500,
        stack: process.env.NODE_ENV === 'development' ? error.stack : ''
      }
    });
  }
});


app.get('/api/nba-news', async (req, res) => {
    try {
      const response = await fetch('http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching NBA news:', error);
      res.status(500).json({ error: 'Failed to fetch NBA news' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  }
  
  // Export the Express app for Vercel
  module.exports = app;