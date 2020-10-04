FROM webrecorder/browserkube

WORKDIR /app/

ADD main.py /app/

ENV APP_MODULE main

COPY assets/ /app/assets/
COPY dist/ /app/dist/
COPY index.html /app/templates/

