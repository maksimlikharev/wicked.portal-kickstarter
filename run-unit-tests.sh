#!/bin/bash

mocha || echo Failed > $TEST_RESULTS./unit_tests_api.failed
