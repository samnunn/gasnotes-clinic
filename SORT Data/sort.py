import pandas as pd
import numpy as np

def invlogit(x):
    return 1 / (1 + np.exp(-x))

def calculateSortScore(procedure, asa, urgency, specialty, malignancy, age):
    # Load data
    procedures = pd.read_csv("SNAP2_procedurelist.csv")

    # Filter procedure
    procedure_info = procedures[procedures['SurgeryProcedure'] == procedure].iloc[0]

    # Calculate SORT
    sort_mort_logit = (
        (asa == 3) * 1.411 +
        (asa == 4) * 2.388 +
        (asa == 5) * 4.081 +
        (urgency == "Expedited") * 1.236 +
        (urgency == "Urgent") * 1.657 +
        (urgency == "Immediate") * 2.452 +
        (specialty in ["Colorectal", "UpperGI", "Bariatric", "HPB", "Thoracic", "Vascular"]) * 0.712 +
        (procedure_info['SurgeryProcedureSeverity'] in ["Xma", "Com"]) * 0.381 +
        (malignancy == True) * 0.667 +
        (65 <= age <= 79) * 0.777 +
        (age >= 80) * 1.591 -
        7.366
    )

    # Calculate risks
    sort_mortality = invlogit(sort_mort_logit)
    return sort_mortality


procedure = "Laparoscopic repair of hiatus hernia with anti-reflux procedure (eg fundoplication)"
asa = 3
urgency = "Elective"
specialty = "UpperGI"
malignancy = False
age = 90

sort = calculateSortScore(procedure, asa, urgency, specialty, malignancy, age)
print(sort)