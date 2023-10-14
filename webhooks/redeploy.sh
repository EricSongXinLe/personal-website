#!/bin/bash
sudo git pull -f origin main   #(OR git pull --ff-only)
sudo npm install                #(OR yarn install)
sudo pm2 reload all
sudo pm2 save