import pandas as pd
import json
import numpy as np

# Read data frames
patients = pd.read_csv('SNAP2_data.csv')
procedures = pd.read_csv('SNAP2_procedurelist.csv', dtype='str')

# Calculate the frequency of each operation
operation_counts = patients['S02PlannedProcedure'].value_counts()

operation_counts = pd.DataFrame({
    'Code': operation_counts.index,
    'frequency': np.log10(operation_counts.values) + 1,
})

merged = pd.merge(procedures, operation_counts, how='outer', on=["Code"])


# Keep only the useful columns
columns_to_keep = ["SurgeryProcedure", "MainGroup", "SubGroup", "SurgeryProcedureSeverity", "frequency"]
merged = merged[columns_to_keep]

merged = merged.fillna(1)
merged.set_index('SurgeryProcedure')

merged = merged.sort_values(by="frequency")

# Convert the DataFrame to a list of dictionaries
data_list = merged.astype('str').to_dict('records')

# Convert the list of dictionaries to a JSON string
json_data = json.dumps(data_list)

# Optionally, you can save the JSON data to a file
with open('oplist.json', 'w') as f:
    f.write(json_data)

# Print the JSON data
print(json_data)