#!/bin/bash
git pull -f origin master   #(OR git pull --ff-only)
npm install                #(OR yarn install)
pm2 reload all
pm2 save