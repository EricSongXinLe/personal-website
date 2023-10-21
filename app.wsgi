import sys
import logging
sys.path.insert(0, '/var/www/html/personal-website')

# Set up logging
logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
 
# Import and run the Flask app
from app import app as application