#!/bin/bash
DIR=$( dirname "${BASH_SOURCE[0]}" )
echo $DIR
docker build -t ikreymer/test-driver:dev $DIR

