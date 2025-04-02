from flask import Flask, request, jsonify
from llm import predict
import os
from dotenv import load_dotenv
from flask_cors import CORS

# Try to load environment variables, but don't fail if file doesn't exist
try:
    load_dotenv('../frontend/.env')
except:
    print("No .env file found, using environment variables")

app = Flask(__name__)
# Configure CORS to allow requests from your frontend
CORS(app)

@app.route('/api/predict', methods=['GET'])
def predict_game():
    """
    API endpoint to predict a game outcome
    
    Query parameters:
    - game_id: ID of the game to predict (optional)
    - date: Date in YYYY-MM-DD format (optional)
    - teams: Comma-separated team names (optional)
    
    Returns:
    - JSON with prediction and teams used
    """
    try:
        game_id = request.args.get('game_id')
        date_str = request.args.get('date')
        
        teams_param = request.args.get('teams')
        teams = teams_param.split(',') if teams_param else None
        
        # If teams param is specified, use it directly
        if teams:
            # Make sure we have exactly two teams
            if len(teams) != 2:
                return jsonify({
                    'error': f'Expected exactly 2 teams, got {len(teams)}'
                }), 400
        
        # Get prediction
        prediction = predict(game_id, date_str, teams)
        
        return jsonify({
            'prediction': prediction,
            'teams_used': teams
        })
    
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port) 