from datetime import datetime

import boto3
import json
from boto3.dynamodb.conditions import Attr

# Connect to DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
S3_BUCKET_NAME = 'ai-model-bucket-output'
# Specify the table name
table = dynamodb.Table('ttn_aws_db')
s3 = boto3.client('s3')



def get_all_items():
    """Fetch all items from the DynamoDB table with pagination."""
    items = []
    response = table.scan()
    items.extend(response.get('Items', []))

    # Continue scanning if there are more pages
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))

    return items


def get_device_data(device_id):
    """Fetch data for a specific device ID with pagination."""
    items = []
    response = table.scan(
        FilterExpression=Attr('device_id').eq(device_id)
    )
    items.extend(response.get('Items', []))

    # Continue scanning if there are more pages
    while 'LastEvaluatedKey' in response:
        response = table.scan(
            ExclusiveStartKey=response['LastEvaluatedKey'],
            FilterExpression=Attr('device_id').eq(device_id)
        )
        items.extend(response.get('Items', []))

    return items

device_1_data = get_device_data("lora-v1")
device_2_data = get_device_data("loradev2")


def add_item(device_id, received_at, payload):
    """Add a new item to the table."""
    item = {
        'device_id': device_id,
        'received_at': received_at,
        'payload': json.dumps(payload),  # Convert payload to JSON string
    }
    table.put_item(Item=item)


def parse_payload(payload):
    """Parse the payload into a dictionary."""
    if isinstance(payload, str):
        try:
            # Parse the JSON string
            return json.loads(payload)
        except json.JSONDecodeError as e:
            raise ValueError(f"Error decoding JSON: {payload}") from e
    elif isinstance(payload, (dict, list)):
        # If it's already a dictionary or list, return it as is
        return payload
    else:
        raise TypeError(f"Unsupported payload type: {type(payload)}. Payload: {payload}")
def store_data_to_s3(data, filename_prefix="dynamodb_data"):
    """Save fetched DynamoDB data to an S3 bucket."""
    try:
        # Generate a unique filename with timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.json"

        # Convert data to JSON
        json_data = json.dumps(data, indent=4)

        # Upload to S3
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=filename,
            Body=json_data,
            ContentType='application/json'
        )

        print(f"Data successfully saved to S3: {filename}")
        return filename

    except Exception as e:
        print(f"Error saving data to S3: {e}")
        return None

