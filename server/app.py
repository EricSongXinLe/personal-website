from flask import Flask, request, jsonify
app = Flask(__name__)
@app.route('/')
def index():
    return 'This is the home page'
@app.route('/submit', methods=['POST'])
def submit_data():
    data = request.get_json()
    # Process the data
    return jsonify({'message': 'Data received successfully'})
if __name__ == '__main__':
    app.run(debug=True)