# QDC Secure Source Connection
This file replace the original file createQlikApp.js in the QDC standard installation along side the new file SourceConnection.js.
This intent is to create on fly connetion to the source with the profiled user credential such that from Qlik Sense each user can access ONLY to the allowed data.

## SourceConnection.json
This is the JSON file used as lookup with all the informations related to the connections details, Users credentials and DB schema prefix. Since it contains the user credential it is a best practice to restrict the read grant only to the qdc system user

## How it works
When publish to Qlik Sense from QDC, a new personal connection to the source is made if both requirements are met:
  1) The podium.qlik.dataconnection.name value is present in Connections section in the SourceConnection.json
  2) The publisher user is present the Users section in the SourceConnection.json with th DB Credentials
In this case a new Source connection will be created only for the Qlik Sense publisher user having the user source credentials. The userId will be appended to the connection name.

## Qlik Settings
In order to provide a more secure environment it is suggested to remove any shared source connection with hight user provileges

### Caveats
This scripts are tested with the following versions:
  Qlik sense Feb 2020
  Qlik Catalog Feb 2020
